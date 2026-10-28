<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    /**
     * Tables backing the account security features: tracked sessions, passkeys and trusted
     * devices, plus the per-user security preferences.
     */
    public function up(): void
    {
        Schema::create('user_sessions', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->char('identifier', 36)->unique();
            $table->char('device_token', 64)->nullable()->unique();
            $table->boolean('remember')->default(false);
            $table->string('method', 32)->default('password');
            $table->string('ip', 45);
            $table->text('user_agent')->nullable();
            $table->timestamp('last_active_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->string('revoked_reason', 32)->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['user_id', 'revoked_at']);
        });

        Schema::create('user_passkeys', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->string('name', 64);
            $table->string('credential_id', 512);
            $table->char('credential_hash', 64)->unique();
            $table->text('public_key');
            $table->unsignedBigInteger('sign_count')->default(0);
            $table->json('transports')->nullable();
            $table->char('aaguid', 36)->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('user_trusted_devices', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->char('token', 64)->unique();
            $table->string('ip', 45);
            $table->text('user_agent')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('security_pin')->nullable()->after('totp_authenticated_at');
            $table->timestamp('security_pin_set_at')->nullable()->after('security_pin');
            $table->unsignedSmallInteger('screen_lock_minutes')->nullable()->after('security_pin_set_at');
            $table->boolean('security_alerts')->default(true)->after('screen_lock_minutes');
            $table->timestamp('locked_until')->nullable()->after('security_alerts');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['security_pin', 'security_pin_set_at', 'screen_lock_minutes', 'security_alerts', 'locked_until']);
        });

        Schema::dropIfExists('user_trusted_devices');
        Schema::dropIfExists('user_passkeys');
        Schema::dropIfExists('user_sessions');
    }
};
