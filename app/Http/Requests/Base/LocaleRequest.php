<?php

namespace Raptor\Http\Requests\Base;

use Illuminate\Foundation\Http\FormRequest;

class LocaleRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            // Several values separated by spaces when the front-end loads them in one request.
            'locale' => ['required', 'string', 'regex:/^[a-z][a-z]( [a-z][a-z]){0,4}$/'],
            'namespace' => ['required', 'string', 'regex:/^[a-z]{1,64}( [a-z]{1,64}){0,9}$/'],
        ];
    }
}
