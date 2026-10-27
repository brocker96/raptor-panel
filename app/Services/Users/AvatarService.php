<?php

namespace Raptor\Services\Users;

use Raptor\Models\User;
use Illuminate\Support\Str;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Raptor\Exceptions\DisplayException;

class AvatarService
{
    public const DIRECTORY = 'avatars';

    public const SIZE = 256;

    /**
     * Stores an uploaded image as the avatar of the user. The image is cropped to a square around
     * its center, resized and re-encoded as WebP, which also strips any metadata (EXIF, GPS ...)
     * and anything that is not image data from the upload.
     */
    public function store(User $user, UploadedFile $file): User
    {
        $source = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));
        if ($source === false) {
            throw new DisplayException('The uploaded file is not a valid image.');
        }

        $width = imagesx($source);
        $height = imagesy($source);
        $side = min($width, $height);

        $avatar = imagecreatetruecolor(self::SIZE, self::SIZE);
        imagealphablending($avatar, false);
        imagesavealpha($avatar, true);
        imagefill($avatar, 0, 0, imagecolorallocatealpha($avatar, 0, 0, 0, 127));
        imagecopyresampled(
            $avatar,
            $source,
            0,
            0,
            (int) (($width - $side) / 2),
            (int) (($height - $side) / 2),
            self::SIZE,
            self::SIZE,
            $side,
            $side,
        );

        ob_start();
        imagewebp($avatar, null, 86);
        $contents = (string) ob_get_clean();
        imagedestroy($source);
        imagedestroy($avatar);

        // A new random name every time, so the file can be cached forever by browsers.
        $name = sprintf('%s-%s.webp', $user->uuid, Str::lower(Str::random(10)));
        Storage::disk('local')->put(self::DIRECTORY . '/' . $name, $contents);

        $previous = $user->avatar;
        $user->forceFill(['avatar' => $name])->save();
        $this->deleteFile($previous);

        return $user;
    }

    public function delete(User $user): User
    {
        $this->deleteFile($user->avatar);
        $user->forceFill(['avatar' => null])->save();

        return $user;
    }

    private function deleteFile(?string $name): void
    {
        if (!empty($name)) {
            Storage::disk('local')->delete(self::DIRECTORY . '/' . basename($name));
        }
    }
}
