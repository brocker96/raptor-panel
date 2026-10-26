import React from 'react';
import BoringAvatar from 'boring-avatars';
import { useStoreState } from '@/state/hooks';

type AvatarProps = React.ComponentProps<typeof BoringAvatar>;

const palette = ['#FFAD08', '#EDD75A', '#73B06F', '#0C8F8F', '#587291'];

type Props = Omit<AvatarProps, 'colors'>;

const _Avatar = ({ variant = 'beam', ...props }: AvatarProps) => (
    <BoringAvatar colors={palette} variant={variant} {...props} />
);

const UserAvatar = ({ variant = 'beam', ...props }: Omit<Props, 'name'>) => {
    const uuid = useStoreState((state) => state.user.data?.uuid);

    return <BoringAvatar colors={palette} name={uuid || 'system'} variant={variant} {...props} />;
};

_Avatar.displayName = 'Avatar';
UserAvatar.displayName = 'Avatar.User';

const Avatar = Object.assign(_Avatar, {
    User: UserAvatar,
});

export default Avatar;
