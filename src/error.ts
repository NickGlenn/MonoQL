/**
 * Custom error class for issues related to the user's configuration.
 */
export class ConfigError extends Error {
    constructor(
        /** The original error. */
        public readonly error: Error,
        /** Additional information about the error. */
        public readonly info: {
            /** The path to the configuration file. */
            configPath: string;
            /** The line number where the error occurred, if known. */
            line?: number;
            /** The column number where the error occurred, if known. */
            column?: number;
        },
    ) {
        super(error.message);
    }
}