<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    /**
     * Settings saved from the admin area are stored using the configuration key they override.
     * The "pterodactyl" configuration was renamed to "raptor", so move the stored keys along.
     */
    public function up(): void
    {
        DB::table('settings')
            ->where('key', 'like', 'settings::pterodactyl:%')
            ->update(['key' => DB::raw("REPLACE(`key`, 'settings::pterodactyl:', 'settings::raptor:')")]);
    }

    public function down(): void
    {
        DB::table('settings')
            ->where('key', 'like', 'settings::raptor:%')
            ->update(['key' => DB::raw("REPLACE(`key`, 'settings::raptor:', 'settings::pterodactyl:')")]);
    }
};
