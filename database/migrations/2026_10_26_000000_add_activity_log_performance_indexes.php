<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    /**
     * Activity logs grow without bound on busy panels. These indexes allow the activity pages
     * to be answered from the index (subject -> log id) and to read the newest entries first
     * instead of sorting every log entry of a server on each request.
     */
    public function up(): void
    {
        Schema::table('activity_log_subjects', function (Blueprint $table) {
            $table->index(['subject_type', 'subject_id', 'activity_log_id'], 'activity_log_subjects_subject_log_index');
        });

        Schema::table('activity_log_subjects', function (Blueprint $table) {
            // Covered by the index above, which shares the same leading columns.
            $table->dropIndex(['subject_type', 'subject_id']);
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->index('timestamp');
        });
    }

    public function down(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropIndex(['timestamp']);
        });

        Schema::table('activity_log_subjects', function (Blueprint $table) {
            $table->index(['subject_type', 'subject_id']);
        });

        Schema::table('activity_log_subjects', function (Blueprint $table) {
            $table->dropIndex('activity_log_subjects_subject_log_index');
        });
    }
};
