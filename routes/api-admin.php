<?php

use Illuminate\Support\Facades\Route;
use Raptor\Http\Controllers\Api\Admin;

/*
|--------------------------------------------------------------------------
| Admin API
|--------------------------------------------------------------------------
|
| Endpoint: /api/admin
|
| Powers the React admin area. Only reachable by administrators using a
| browser session, application API keys keep using /api/application.
|
*/

Route::get('/overview', [Admin\OverviewController::class, 'index']);
Route::get('/system', [Admin\OverviewController::class, 'system']);
Route::post('/system/cache/clear', [Admin\SystemController::class, 'clearCache']);
Route::get('/system/failed-jobs', [Admin\SystemController::class, 'failedJobs']);
Route::post('/system/failed-jobs/{uuid}/retry', [Admin\SystemController::class, 'retry']);
Route::delete('/system/failed-jobs/{uuid}', [Admin\SystemController::class, 'forget']);
Route::delete('/system/failed-jobs', [Admin\SystemController::class, 'flush']);

Route::group(['prefix' => '/updates'], function () {
    Route::get('/', [Admin\UpdateController::class, 'index']);
    Route::get('/status', [Admin\UpdateController::class, 'status']);
    Route::put('/channel', [Admin\UpdateController::class, 'channel']);
    Route::post('/install', [Admin\UpdateController::class, 'install']);
    Route::post('/rollback', [Admin\UpdateController::class, 'rollback']);
    Route::delete('/queue', [Admin\UpdateController::class, 'cancel']);
});

Route::get('/activity', [Admin\ActivityController::class, 'index']);
Route::get('/activity/events', [Admin\ActivityController::class, 'events']);

Route::group(['prefix' => '/settings'], function () {
    Route::get('/', [Admin\SettingsController::class, 'index']);
    Route::patch('/general', [Admin\SettingsController::class, 'updateGeneral']);
    Route::patch('/mail', [Admin\SettingsController::class, 'updateMail']);
    Route::post('/mail/test', [Admin\SettingsController::class, 'testMail']);
    Route::put('/mail/driver', [Admin\SettingsController::class, 'updateMailDriver']);
    Route::patch('/advanced', [Admin\SettingsController::class, 'updateAdvanced']);
    Route::get('/cloudflare', [Admin\CloudflareController::class, 'index']);
    Route::patch('/cloudflare', [Admin\CloudflareController::class, 'update']);
    Route::post('/cloudflare/ranges', [Admin\CloudflareController::class, 'refresh']);
});

Route::group(['prefix' => '/api-keys'], function () {
    Route::get('/', [Admin\ApiKeyController::class, 'index']);
    Route::post('/', [Admin\ApiKeyController::class, 'store']);
    Route::delete('/{identifier}', [Admin\ApiKeyController::class, 'delete']);
});

Route::group(['prefix' => '/users'], function () {
    Route::get('/', [Admin\UserController::class, 'index']);
    Route::post('/', [Admin\UserController::class, 'store']);
    Route::get('/{user:id}', [Admin\UserController::class, 'view']);
    Route::patch('/{user:id}', [Admin\UserController::class, 'update']);
    Route::delete('/{user:id}', [Admin\UserController::class, 'delete']);
    Route::post('/{user:id}/2fa/disable', [Admin\UserController::class, 'disableTwoFactor']);
    Route::delete('/{user:id}/avatar', [Admin\UserController::class, 'deleteAvatar']);
});

Route::group(['prefix' => '/servers'], function () {
    Route::get('/', [Admin\ServerController::class, 'index']);
    Route::get('/{server:id}', [Admin\ServerController::class, 'view']);
    Route::post('/{server:id}/toggle-install', [Admin\ServerController::class, 'toggleInstall']);
    Route::post('/{server:id}/transfer', [Admin\ServerController::class, 'transfer']);
    Route::post('/{server:id}/mounts', [Admin\ServerController::class, 'attachMount']);
    Route::delete('/{server:id}/mounts/{mount}', [Admin\ServerController::class, 'detachMount'])->whereNumber('mount');
});

Route::group(['prefix' => '/nodes'], function () {
    Route::get('/', [Admin\NodeController::class, 'index']);
    Route::post('/', [Admin\NodeController::class, 'store']);
    Route::get('/{node:id}', [Admin\NodeController::class, 'view']);
    Route::patch('/{node:id}', [Admin\NodeController::class, 'update']);
    Route::delete('/{node:id}', [Admin\NodeController::class, 'delete']);
    Route::get('/{node:id}/system', [Admin\NodeController::class, 'system']);
    Route::get('/{node:id}/configuration', [Admin\NodeController::class, 'configuration']);
    Route::get('/{node:id}/allocations', [Admin\NodeController::class, 'allocations']);
    Route::post('/{node:id}/allocations', [Admin\NodeController::class, 'storeAllocations']);
    Route::post('/{node:id}/allocations/delete', [Admin\NodeController::class, 'deleteAllocations']);
    Route::patch('/{node:id}/allocations/{allocation:id}', [Admin\NodeController::class, 'updateAllocation']);
});

Route::group(['prefix' => '/locations'], function () {
    Route::get('/', [Admin\LocationController::class, 'index']);
    Route::post('/', [Admin\LocationController::class, 'store']);
    Route::patch('/{location:id}', [Admin\LocationController::class, 'update']);
    Route::delete('/{location:id}', [Admin\LocationController::class, 'delete']);
});

Route::group(['prefix' => '/database-hosts'], function () {
    Route::get('/', [Admin\DatabaseHostController::class, 'index']);
    Route::post('/', [Admin\DatabaseHostController::class, 'store']);
    Route::get('/{host:id}', [Admin\DatabaseHostController::class, 'view']);
    Route::patch('/{host:id}', [Admin\DatabaseHostController::class, 'update']);
    Route::delete('/{host:id}', [Admin\DatabaseHostController::class, 'delete']);
});

Route::group(['prefix' => '/mounts'], function () {
    Route::get('/', [Admin\MountController::class, 'index']);
    Route::post('/', [Admin\MountController::class, 'store']);
    Route::get('/{mount:id}', [Admin\MountController::class, 'view']);
    Route::patch('/{mount:id}', [Admin\MountController::class, 'update']);
    Route::delete('/{mount:id}', [Admin\MountController::class, 'delete']);
    Route::put('/{mount:id}/relations', [Admin\MountController::class, 'sync']);
});

Route::group(['prefix' => '/nests'], function () {
    Route::get('/', [Admin\NestController::class, 'index']);
    Route::post('/', [Admin\NestController::class, 'store']);
    Route::patch('/{nest:id}', [Admin\NestController::class, 'update']);
    Route::delete('/{nest:id}', [Admin\NestController::class, 'delete']);
});

Route::group(['prefix' => '/eggs'], function () {
    Route::post('/', [Admin\EggController::class, 'store']);
    Route::post('/import', [Admin\EggController::class, 'import']);
    Route::get('/{egg:id}', [Admin\EggController::class, 'view']);
    Route::patch('/{egg:id}', [Admin\EggController::class, 'update']);
    Route::delete('/{egg:id}', [Admin\EggController::class, 'delete']);
    Route::get('/{egg:id}/export', [Admin\EggController::class, 'export']);
    Route::post('/{egg:id}/import', [Admin\EggController::class, 'reimport']);
    Route::patch('/{egg:id}/script', [Admin\EggController::class, 'script']);
    Route::post('/{egg:id}/variables', [Admin\EggController::class, 'storeVariable']);
    Route::patch('/{egg:id}/variables/{variable:id}', [Admin\EggController::class, 'updateVariable']);
    Route::delete('/{egg:id}/variables/{variable:id}', [Admin\EggController::class, 'deleteVariable']);
});
