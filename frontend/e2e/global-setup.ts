import {
    existsSync,
} from 'node:fs';

import {
    spawnSync,
} from 'node:child_process';

import path from 'node:path';

export default function globalSetup(): void {
    /**
     * Khi test server bên ngoài,
     * không được tự động đụng DB local.
     */
    if (
        process.env['E2E_EXTERNAL'] ===
        'true'
    ) {
        return;
    }

    const backendDirectory =
        resolveBackendDirectory();

    console.log(
        '[Playwright] Chuẩn bị dữ liệu E2E...',
    );

    runBackendScript(
        backendDirectory,
        'db:seed',
    );

    runBackendScript(
        backendDirectory,
        'db:seed:e2e',
    );
}

function resolveBackendDirectory(): string {
    const candidates = [
        /**
         * Khi cwd = frontend
         */
        path.resolve(
            process.cwd(),
            '../backend',
        ),

        /**
         * Khi cwd = repository root
         */
        path.resolve(
            process.cwd(),
            'backend',
        ),
    ];

    const backendDirectory =
        candidates.find(
            (candidate) =>
                existsSync(
                    path.join(
                        candidate,
                        'package.json',
                    ),
                ),
        );

    if (!backendDirectory) {
        throw new Error(
            [
                'Không tìm thấy thư mục backend.',
                'Playwright cần backend để seed E2E user.',
            ].join(' '),
        );
    }

    return backendDirectory;
}

function runBackendScript(
    cwd: string,
    script: string,
): void {
    const npmCommand =
        process.platform ===
            'win32'
            ? 'npm.cmd'
            : 'npm';

    const result =
        spawnSync(
            npmCommand,
            [
                'run',
                script,
            ],
            {
                cwd,

                env:
                    process.env,

                stdio:
                    'inherit',

                shell:
                    false,
            },
        );

    if (
        result.error
    ) {
        throw result.error;
    }

    if (
        result.status !== 0
    ) {
        throw new Error(
            `Backend script "${script}" thất bại với exit code ${result.status ?? 'unknown'}.`,
        );
    }
}