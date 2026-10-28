<?php

use Raptor\Enum\ResourceLimit;
use Illuminate\Support\Facades\Route;
use Raptor\Http\Controllers\Api\Client;
use Raptor\Http\Middleware\Activity\ServerSubject;
use Raptor\Http\Middleware\Activity\AccountSubject;
use Raptor\Http\Middleware\RequireTwoFactorAuthentication;
use Raptor\Http\Middleware\Api\Client\Server\ResourceBelongsToServer;
use Raptor\Http\Middleware\Api\Client\Server\AuthenticateServerAccess;

/*
|--------------------------------------------------------------------------
| Client Control API
|--------------------------------------------------------------------------
|
| Endpoint: /api/client
|
*/
Route::get('/', [Client\ClientController::class, 'index'])->name('api:client.index');
Route::get('/permissions', [Client\ClientController::class, 'permissions']);

Route::prefix('/account')->middleware(AccountSubject::class)->group(function () {
    Route::prefix('/')->withoutMiddleware(RequireTwoFactorAuthentication::class)->group(function () {
        Route::get('/', [Client\AccountController::class, 'index'])->name('api:client.account');
        Route::get('/two-factor', [Client\TwoFactorController::class, 'index']);
        Route::post('/two-factor', [Client\TwoFactorController::class, 'store']);
        Route::post('/two-factor/disable', [Client\TwoFactorController::class, 'delete']);
        Route::put('/language', [Client\AccountController::class, 'updateLanguage']);

        Route::get('/security', [Client\SecurityController::class, 'index']);
        Route::get('/security/state', [Client\SecurityController::class, 'state']);
        Route::post('/security/confirm', [Client\SecurityController::class, 'confirm'])->middleware('throttle:10,1');
        Route::post('/security/confirm/passkey', [Client\SecurityController::class, 'confirmPasskeyOptions']);
        Route::post('/security/lock', [Client\SecurityController::class, 'lock']);
        Route::post('/security/unlock', [Client\SecurityController::class, 'unlock'])->middleware('throttle:10,1');
        Route::delete('/security/sessions/{identifier}', [Client\SecurityController::class, 'revokeSession']);
        Route::post('/security/sessions/revoke-others', [Client\SecurityController::class, 'revokeOtherSessions']);
    });

    Route::prefix('/security')->group(function () {
        Route::put('/preferences', [Client\SecurityController::class, 'updatePreferences']);
        Route::put('/pin', [Client\SecurityController::class, 'updatePin'])->middleware('confirm:strong');
        Route::delete('/pin', [Client\SecurityController::class, 'deletePin'])->middleware('confirm:strong');
        Route::delete('/trusted-devices', [Client\SecurityController::class, 'forgetTrustedDevices']);
        Route::delete('/trusted-devices/{id}', [Client\SecurityController::class, 'forgetTrustedDevice'])->whereNumber('id');
        Route::post('/passkeys/options', [Client\SecurityController::class, 'passkeyOptions'])->middleware('confirm:strong');
        Route::post('/passkeys', [Client\SecurityController::class, 'storePasskey'])->middleware('confirm:strong');
        Route::patch('/passkeys/{id}', [Client\SecurityController::class, 'renamePasskey'])->whereNumber('id');
        Route::delete('/passkeys/{id}', [Client\SecurityController::class, 'deletePasskey'])->whereNumber('id')->middleware('confirm:strong');
        Route::post('/recovery-codes', [Client\SecurityController::class, 'regenerateRecoveryCodes'])->middleware('confirm:strong');
    });

    Route::put('/email', [Client\AccountController::class, 'updateEmail'])
        ->middleware('throttle')
        ->name('api:client.account.update-email');
    Route::put('/password', [Client\AccountController::class, 'updatePassword'])->name('api:client.account.update-password');
    Route::post('/avatar', [Client\AccountAvatarController::class, 'store'])->middleware('throttle:10,1');
    Route::delete('/avatar', [Client\AccountAvatarController::class, 'delete']);

    Route::get('/activity', Client\ActivityLogController::class)->name('api:client.account.activity');

    Route::get('/api-keys', [Client\ApiKeyController::class, 'index']);
    Route::post('/api-keys', [Client\ApiKeyController::class, 'store'])->middleware('confirm');
    Route::delete('/api-keys/{identifier}', [Client\ApiKeyController::class, 'delete'])->middleware('confirm');

    Route::prefix('/ssh-keys')->group(function () {
        Route::get('/', [Client\SSHKeyController::class, 'index']);
        Route::post('/', [Client\SSHKeyController::class, 'store'])->middleware('confirm');
        Route::post('/remove', [Client\SSHKeyController::class, 'delete'])->middleware('confirm');
    });
});

/*
|--------------------------------------------------------------------------
| Client Control API
|--------------------------------------------------------------------------
|
| Endpoint: /api/client/servers/{server}
|
*/
Route::group([
    'prefix' => '/servers/{server}',
    'middleware' => [
        ServerSubject::class,
        AuthenticateServerAccess::class,
        ResourceBelongsToServer::class,
    ],
], function () {
    Route::get('/', [Client\Servers\ServerController::class, 'index'])->name('api:client:server.view');
    Route::middleware([ResourceLimit::Websocket->middleware()])
        ->get('/websocket', Client\Servers\WebsocketController::class)
        ->name('api:client:server.ws');
    Route::get('/resources', Client\Servers\ResourceUtilizationController::class)->name('api:client:server.resources');
    Route::get('/activity', Client\Servers\ActivityLogController::class)->name('api:client:server.activity');

    Route::post('/command', [Client\Servers\CommandController::class, 'index']);
    Route::post('/power', [Client\Servers\PowerController::class, 'index']);

    Route::group(['prefix' => '/databases'], function () {
        Route::get('/', [Client\Servers\DatabaseController::class, 'index']);
        Route::middleware([ResourceLimit::Database->middleware()])
            ->post('/', [Client\Servers\DatabaseController::class, 'store']);
        Route::post('/{database}/rotate-password', [Client\Servers\DatabaseController::class, 'rotatePassword'])->middleware('confirm');
        Route::delete('/{database}', [Client\Servers\DatabaseController::class, 'delete'])->middleware('confirm');
    });

    Route::group(['prefix' => '/files'], function () {
        Route::get('/list', [Client\Servers\FileController::class, 'directory']);
        Route::get('/contents', [Client\Servers\FileController::class, 'contents']);
        Route::get('/download', [Client\Servers\FileController::class, 'download']);
        Route::put('/rename', [Client\Servers\FileController::class, 'rename']);
        Route::post('/copy', [Client\Servers\FileController::class, 'copy']);
        Route::post('/write', [Client\Servers\FileController::class, 'write']);
        Route::post('/compress', [Client\Servers\FileController::class, 'compress']);
        Route::post('/decompress', [Client\Servers\FileController::class, 'decompress']);
        Route::post('/delete', [Client\Servers\FileController::class, 'delete']);
        Route::post('/create-folder', [Client\Servers\FileController::class, 'create']);
        Route::post('/chmod', [Client\Servers\FileController::class, 'chmod']);
        Route::middleware([ResourceLimit::FilePull->middleware()])
            ->post('/pull', [Client\Servers\FileController::class, 'pull']);
        Route::get('/upload', Client\Servers\FileUploadController::class);
    });

    Route::group(['prefix' => '/schedules'], function () {
        Route::get('/', [Client\Servers\ScheduleController::class, 'index']);
        Route::middleware([ResourceLimit::Schedule->middleware()])
            ->post('/', [Client\Servers\ScheduleController::class, 'store']);
        Route::get('/{schedule}', [Client\Servers\ScheduleController::class, 'view']);
        Route::post('/{schedule}', [Client\Servers\ScheduleController::class, 'update']);
        Route::post('/{schedule}/execute', [Client\Servers\ScheduleController::class, 'execute']);
        Route::delete('/{schedule}', [Client\Servers\ScheduleController::class, 'delete']);

        Route::post('/{schedule}/tasks', [Client\Servers\ScheduleTaskController::class, 'store']);
        Route::post('/{schedule}/tasks/{task}', [Client\Servers\ScheduleTaskController::class, 'update']);
        Route::delete('/{schedule}/tasks/{task}', [Client\Servers\ScheduleTaskController::class, 'delete']);
    });

    Route::group(['prefix' => '/network'], function () {
        Route::get('/allocations', [Client\Servers\NetworkAllocationController::class, 'index']);
        Route::middleware([ResourceLimit::Allocation->middleware()])
            ->post('/allocations', [Client\Servers\NetworkAllocationController::class, 'store']);
        Route::post('/allocations/{allocation}', [Client\Servers\NetworkAllocationController::class, 'update']);
        Route::post('/allocations/{allocation}/primary', [Client\Servers\NetworkAllocationController::class, 'setPrimary']);
        Route::delete('/allocations/{allocation}', [Client\Servers\NetworkAllocationController::class, 'delete']);
    });

    Route::group(['prefix' => '/users'], function () {
        Route::get('/', [Client\Servers\SubuserController::class, 'index']);
        Route::middleware([ResourceLimit::Subuser->middleware(), 'confirm'])
            ->post('/', [Client\Servers\SubuserController::class, 'store']);
        Route::get('/{user}', [Client\Servers\SubuserController::class, 'view']);
        Route::post('/{user}', [Client\Servers\SubuserController::class, 'update'])->middleware('confirm');
        Route::delete('/{user}', [Client\Servers\SubuserController::class, 'delete'])->middleware('confirm');
    });

    Route::group(['prefix' => '/backups'], function () {
        Route::get('/', [Client\Servers\BackupController::class, 'index']);
        Route::post('/', [Client\Servers\BackupController::class, 'store']);
        Route::get('/{backup}', [Client\Servers\BackupController::class, 'view']);
        Route::get('/{backup}/download', [Client\Servers\BackupController::class, 'download']);
        Route::post('/{backup}/lock', [Client\Servers\BackupController::class, 'toggleLock']);
        Route::middleware([ResourceLimit::Backup->middleware(), 'confirm'])
            ->post('/{backup}/restore', [Client\Servers\BackupController::class, 'restore']);
        Route::delete('/{backup}', [Client\Servers\BackupController::class, 'delete'])->middleware('confirm');
    });

    Route::group(['prefix' => '/startup'], function () {
        Route::get('/', [Client\Servers\StartupController::class, 'index']);
        Route::put('/variable', [Client\Servers\StartupController::class, 'update']);
    });

    Route::group(['prefix' => '/settings'], function () {
        Route::post('/rename', [Client\Servers\SettingsController::class, 'rename']);
        Route::post('/reinstall', [Client\Servers\SettingsController::class, 'reinstall'])->middleware('confirm');
        Route::put('/docker-image', [Client\Servers\SettingsController::class, 'dockerImage']);
    });
});
