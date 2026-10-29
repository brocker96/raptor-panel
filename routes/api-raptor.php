<?php

use Illuminate\Support\Facades\Route;
use Raptor\Http\Controllers\Api\Raptor;

/*
|--------------------------------------------------------------------------
| Raptor API
|--------------------------------------------------------------------------
|
| Endpoint: /api/raptor/v1
|
| The API for billing systems, see docs/raptor-api.md. Every route names the
| application key permission it needs.
|
*/

Route::get('/', [Raptor\MetaController::class, 'index']);
Route::get('/eggs', [Raptor\MetaController::class, 'eggs'])->middleware('raptor.key:eggs,read');
Route::get('/locations', [Raptor\MetaController::class, 'locations'])->middleware('raptor.key:locations,read');
Route::get('/nodes', [Raptor\MetaController::class, 'nodes'])->middleware('raptor.key:nodes,read');

Route::prefix('/packages')->group(function () {
    Route::get('/', [Raptor\PackageController::class, 'index']);
    Route::get('/{package}', [Raptor\PackageController::class, 'show']);
    Route::get('/{package}/availability', [Raptor\PackageController::class, 'availability']);
    Route::middleware('raptor.key:servers,write')->group(function () {
        Route::post('/', [Raptor\PackageController::class, 'store']);
        Route::patch('/{package}', [Raptor\PackageController::class, 'update']);
        Route::delete('/{package}', [Raptor\PackageController::class, 'delete']);
        Route::post('/{package}/duplicate', [Raptor\PackageController::class, 'duplicate']);
    });
});

Route::prefix('/servers')->group(function () {
    Route::get('/', [Raptor\ServerController::class, 'index']);
    Route::get('/{server}', [Raptor\ServerController::class, 'show']);
    Route::get('/{server}/resources', [Raptor\ServerController::class, 'resources']);
    Route::middleware('raptor.key:servers,write')->group(function () {
        Route::post('/', [Raptor\ServerController::class, 'store'])->middleware('raptor.key:users,write');
        Route::patch('/{server}', [Raptor\ServerController::class, 'update']);
        Route::put('/{server}/package', [Raptor\ServerController::class, 'package']);
        Route::patch('/{server}/limits', [Raptor\ServerController::class, 'limits']);
        Route::post('/{server}/suspend', [Raptor\ServerController::class, 'suspend']);
        Route::post('/{server}/unsuspend', [Raptor\ServerController::class, 'unsuspend']);
        Route::post('/{server}/reinstall', [Raptor\ServerController::class, 'reinstall']);
        Route::post('/{server}/power', [Raptor\ServerController::class, 'power']);
        Route::delete('/{server}', [Raptor\ServerController::class, 'delete']);
    });
});

Route::prefix('/users')->middleware('raptor.key:users,read')->group(function () {
    Route::get('/', [Raptor\UserController::class, 'index']);
    Route::get('/{user}', [Raptor\UserController::class, 'show']);
    Route::get('/{user}/servers', [Raptor\UserController::class, 'servers'])->middleware('raptor.key:servers,read');
    Route::middleware('raptor.key:users,write')->group(function () {
        Route::post('/', [Raptor\UserController::class, 'store']);
        Route::patch('/{user}', [Raptor\UserController::class, 'update']);
        Route::post('/{user}/login-link', [Raptor\UserController::class, 'loginLink']);
        Route::delete('/{user}', [Raptor\UserController::class, 'delete']);
    });
});

Route::prefix('/webhooks')->middleware('raptor.key:servers,write')->group(function () {
    Route::get('/', [Raptor\WebhookController::class, 'index']);
    Route::post('/', [Raptor\WebhookController::class, 'store']);
    Route::patch('/{webhook}', [Raptor\WebhookController::class, 'update']);
    Route::delete('/{webhook}', [Raptor\WebhookController::class, 'delete']);
    Route::post('/{webhook}/rotate-secret', [Raptor\WebhookController::class, 'rotate']);
    Route::post('/{webhook}/test', [Raptor\WebhookController::class, 'test']);
    Route::get('/{webhook}/deliveries', [Raptor\WebhookController::class, 'deliveries']);
    Route::post('/{webhook}/deliveries/{delivery}/redeliver', [Raptor\WebhookController::class, 'redeliver']);
});
