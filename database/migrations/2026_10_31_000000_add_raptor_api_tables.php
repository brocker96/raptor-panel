<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

return new class () extends Migration {
    /**
     * Server packages (plans a billing system sells), the package a server was made from, and
     * webhooks that tell the billing system what happened to its servers.
     */
    public function up(): void
    {
        Schema::create('server_packages', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 64)->unique();
            $table->string('name', 191);
            $table->text('description')->nullable();
            $table->boolean('active')->default(true);
            $table->unsignedInteger('egg_id');
            $table->string('image', 191)->nullable();
            $table->text('startup')->nullable();
            $table->json('environment')->nullable();
            $table->unsignedInteger('memory');
            $table->integer('swap')->default(0);
            $table->unsignedInteger('disk');
            $table->unsignedInteger('io')->default(500);
            $table->unsignedInteger('cpu')->default(0);
            $table->string('threads', 191)->nullable();
            $table->boolean('oom_disabled')->default(true);
            $table->unsignedInteger('database_limit')->default(0);
            $table->unsignedInteger('allocation_limit')->default(0);
            $table->unsignedInteger('backup_limit')->default(0);
            $table->json('location_ids')->nullable();
            $table->json('node_ids')->nullable();
            $table->json('port_range')->nullable();
            $table->boolean('dedicated_ip')->default(false);
            $table->boolean('start_on_completion')->default(true);
            $table->json('metadata')->nullable();
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();

            $table->foreign('egg_id')->references('id')->on('eggs');
        });

        Schema::table('servers', function (Blueprint $table) {
            $table->foreignId('package_id')->nullable()->after('egg_id')->constrained('server_packages')->nullOnDelete();
        });

        Schema::create('raptor_webhooks', function (Blueprint $table) {
            $table->id();
            $table->string('url', 2048);
            $table->text('secret');
            $table->json('events')->nullable();
            $table->boolean('active')->default(true);
            $table->string('description', 191)->nullable();
            $table->unsignedInteger('failures')->default(0);
            $table->timestamp('last_delivery_at')->nullable();
            $table->timestamps();
        });

        Schema::create('raptor_webhook_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('webhook_id')->constrained('raptor_webhooks')->cascadeOnDelete();
            $table->uuid('uuid');
            $table->string('event', 64);
            $table->json('payload');
            $table->unsignedSmallInteger('status')->nullable();
            $table->string('error', 500)->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();

            $table->index(['webhook_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('raptor_webhook_deliveries');
        Schema::dropIfExists('raptor_webhooks');
        Schema::table('servers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('package_id');
        });
        Schema::dropIfExists('server_packages');
    }
};
