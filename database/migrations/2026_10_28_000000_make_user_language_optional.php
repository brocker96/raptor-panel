<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

return new class () extends Migration {
    /**
     * Users without a language of their own follow the default language of the Panel. English
     * used to be the only language, so nobody picked it on purpose.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('language', 5)->nullable()->default(null)->change();
        });

        DB::table('users')->where('language', 'en')->update(['language' => null]);
    }

    public function down(): void
    {
        DB::table('users')->whereNull('language')->update(['language' => 'en']);

        Schema::table('users', function (Blueprint $table) {
            $table->string('language', 5)->default('en')->change();
        });
    }
};
