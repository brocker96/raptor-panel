<?php

/*
 * Raptor Panel is based on Pterodactyl Panel, whose classes lived in the "Pterodactyl\" namespace.
 * Class names are persisted in a few places (queued jobs, failed jobs and database notifications),
 * so the old names are aliased to the new ones in order for existing data to keep working after
 * upgrading.
 */
spl_autoload_register(function (string $class): void {
    if (!str_starts_with($class, 'Pterodactyl\\')) {
        return;
    }

    // Classes that were renamed in addition to moving namespace.
    $renamed = [
        'Pterodactyl\\Exceptions\\PterodactylException' => 'Raptor\\Exceptions\\RaptorException',
        'Pterodactyl\\Extensions\\League\\Fractal\\Serializers\\PterodactylSerializer' => 'Raptor\\Extensions\\League\\Fractal\\Serializers\\RaptorSerializer',
    ];

    $target = $renamed[$class] ?? 'Raptor\\' . substr($class, strlen('Pterodactyl\\'));
    if (class_exists($target) || interface_exists($target) || trait_exists($target) || enum_exists($target)) {
        class_alias($target, $class);
    }
});
