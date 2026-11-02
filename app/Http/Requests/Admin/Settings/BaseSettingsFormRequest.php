<?php

namespace Raptor\Http\Requests\Admin\Settings;

use Illuminate\Validation\Rule;
use Raptor\Traits\Helpers\AvailableLanguages;
use Raptor\Http\Requests\Admin\AdminFormRequest;

class BaseSettingsFormRequest extends AdminFormRequest
{
    use AvailableLanguages;

    public function rules(): array
    {
        return [
            'app:name' => 'required|string|max:191',
            'raptor:auth:2fa_required' => 'required|integer|in:0,1,2',
            // Optional so the classic settings page, which has no such fields, keeps working.
            'raptor:support:enabled' => 'sometimes|in:true,false',
            'raptor:support:mail' => 'sometimes|in:true,false',
            'raptor:billing:url' => 'sometimes|nullable|string|max:500|starts_with:https://,http://',
            'raptor:billing:server_url' => 'sometimes|nullable|string|max:500|starts_with:https://,http://',
            'app:locale' => ['required', 'string', Rule::in(array_keys($this->getAvailableLanguages()))],
        ];
    }

    public function attributes(): array
    {
        return [
            'app:name' => 'Company Name',
            'raptor:auth:2fa_required' => 'Require 2-Factor Authentication',
            'app:locale' => 'Default Language',
        ];
    }
}
