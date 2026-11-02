<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

return new class () extends Migration {
    /**
     * Why a server is suspended and where its owner can pay, shown on the suspended screen.
     */
    public function up(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            $table->string('suspension_reason', 500)->nullable()->after('status');
            $table->string('suspension_url', 2048)->nullable()->after('suspension_reason');
        });
    }

    public function down(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            $table->dropColumn(['suspension_reason', 'suspension_url']);
        });
    }
};
