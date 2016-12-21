'use strict';

const gulp = require('gulp');

const lintOptions =
{
    envs: ['node', 'es6'],
    eslintRules:
    {
        'arrow-body-style':         ['error'],
        'arrow-parens':             ['error', 'as-needed'],
        'arrow-spacing':            'error',
        'constructor-super':        'error',
        'no-class-assign':          'error',
        'no-dupe-class-members':    'error',
        'no-new-symbol':            'error',
        'no-this-before-super':     'error',
        'no-useless-computed-key':  'error',
        'no-useless-constructor':   'error',
        'no-useless-rename':        'error',
        'no-var':                   'error',
        'object-shorthand':         'error',
        'prefer-arrow-callback':    'error',
        'prefer-numeric-literals':  'error',
        'prefer-spread':            'error',
        'prefer-template':          'error',
        'rest-spread-spacing':      'error',
        'template-curly-spacing':   'error',
    },
    parserOptions: { ecmaVersion: 7 }
};

gulp.task(
    'lint',
    () =>
    {
        const lint = require('gulp-fasttime-lint');
        
        const stream = gulp.src('*.js').pipe(lint(lintOptions));
        return stream;
    }
);

gulp.task('default', ['lint']);
