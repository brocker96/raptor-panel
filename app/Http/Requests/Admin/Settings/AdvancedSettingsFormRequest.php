<?php

namespace Raptor\Http\Requests\Admin\Settings;

use Raptor\Http\Requests\Admin\AdminFormRequest;

class AdvancedSettingsFormRequest extends AdminFormRequest
{
    /**
     * Return all the rules to apply to this request's data.
     */
    public function rules(): array
    {
        return [
            'recaptcha:enabled' => 'required|in:true,false',
            'recaptcha:secret_key' => 'required|string|max:191',
            'recaptcha:website_key' => 'required|string|max:191',
            'raptor:guzzle:timeout' => 'required|integer|between:1,60',
            'raptor:guzzle:connect_timeout' => 'required|integer|between:1,60',
            'raptor:client_features:allocations:enabled' => 'required|in:true,false',
            'raptor:client_features:allocations:range_start' => [
                'nullable',
                'required_if:raptor:client_features:allocations:enabled,true',
                'integer',
                'between:1024,65535',
            ],
            'raptor:client_features:allocations:range_end' => [
                'nullable',
                'required_if:raptor:client_features:allocations:enabled,true',
                'integer',
                'between:1024,65535',
                'gt:raptor:client_features:allocations:range_start',
            ],
        ];
    }

    public function attributes(): array
    {
        return [
            'recaptcha:enabled' => 'reCAPTCHA Enabled',
            'recaptcha:secret_key' => 'reCAPTCHA Secret Key',
            'recaptcha:website_key' => 'reCAPTCHA Website Key',
            'raptor:guzzle:timeout' => 'HTTP Request Timeout',
            'raptor:guzzle:connect_timeout' => 'HTTP Connection Timeout',
            'raptor:client_features:allocations:enabled' => 'Auto Create Allocations Enabled',
            'raptor:client_features:allocations:range_start' => 'Starting Port',
            'raptor:client_features:allocations:range_end' => 'Ending Port',
        ];
    }
}
