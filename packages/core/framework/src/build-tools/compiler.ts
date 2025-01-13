import path from "path"
import type tsStatic from "typescript"
import { getConfigFile } from "@medusajs/utils"
import { access, constants, copyFile, rm } from "fs/promises"
import type { AdminOptions, ConfigModule, Logger } from "@medusajs/types"

/**
 * The compiler exposes the opinionated APIs for compiling Medusa
 * applications and plugins. You can perform the following
 * actions.
 *
 * - loadTSConfigFile: Load and parse the TypeScript config file. All errors
 *   will be reported using the logger.
 *
 * - buildAppBackend: Compile the Medusa application backend source code to the
 *   ".medusa/server" directory. The admin source and integration-tests are
 *   skipped.
 *
 * - buildAppFrontend: Compile the admin extensions using the "@medusjs/admin-bundler"
 *   package. Admin can be compiled for self hosting (aka adminOnly), or can be compiled
 *   to be bundled with the backend output.
 */
export class Compiler {
  #logger: Logger
  #projectRoot: string
  #adminSourceFolder: string
  #adminOnlyDistFolder: string
  #tsCompiler?: typeof tsStatic

  constructor(projectRoot: string, logger: Logger) {
    this.#projectRoot = projectRoot
    this.#logger = logger
    this.#adminSourceFolder = path.join(this.#projectRoot, "src/admin")
    this.#adminOnlyDistFolder = path.join(this.#projectRoot, ".medusa/admin")
  }

  /**
   * Util to track duration using hrtime
   */
  #trackDuration() {
    const startTime = process.hrtime()
    return {
      getSeconds() {
        const duration = process.hrtime(startTime)
        return (duration[0] + duration[1] / 1e9).toFixed(2)
      },
    }
  }

  /**
   * Returns the dist folder from the tsconfig.outDir property
   * or uses the ".medusa/server" folder
   */
  #computeDist(tsConfig: { options: { outDir?: string } }): string {
    const distFolder = tsConfig.options.outDir ?? ".medusa/server"
    return path.isAbsolute(distFolder)
      ? distFolder
      : path.join(this.#projectRoot, distFolder)
  }

  /**
   * Imports and stores a reference to the TypeScript compiler.
   * We dynamically import "typescript", since its is a dev
   * only dependency
   */
  async #loadTSCompiler() {
    if (!this.#tsCompiler) {
      this.#tsCompiler = await import("typescript")
    }
    return this.#tsCompiler
  }

  /**
   * Copies the file to the destination without throwing any
   * errors if the source file is missing
   */
  async #copy(source: string, destination: string) {
    let sourceExists = false
    try {
      await access(source, constants.F_OK)
      sourceExists = true
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error
      }
    }

    if (sourceExists) {
      await copyFile(path.join(source), path.join(destination))
    }
  }

  /**
   * Copies package manager files from the project root
   * to the specified dist folder
   */
  async #copyPkgManagerFiles(dist: string) {
    /**
     * Copying package manager files
     */
    await this.#copy(
      path.join(this.#projectRoot, "package.json"),
      path.join(dist, "package.json")
    )
    await this.#copy(
      path.join(this.#projectRoot, "yarn.lock"),
      path.join(dist, "yarn.lock")
    )
    await this.#copy(
      path.join(this.#projectRoot, "pnpm.lock"),
      path.join(dist, "pnpm.lock")
    )
    await this.#copy(
      path.join(this.#projectRoot, "package-lock.json"),
      path.join(dist, "package-lock.json")
    )
  }

  /**
   * Removes the directory and its children recursively and
   * ignores any errors
   */
  async #clean(path: string) {
    await rm(path, { recursive: true }).catch(() => {})
  }

  /**
   * Loads the medusa config file and prints the error to
   * the console (in case of any errors). Otherwise, the
   * file path and the parsed config is returned
   */
  async #loadMedusaConfig() {
    const { configModule, configFilePath, error } =
      await getConfigFile<ConfigModule>(this.#projectRoot, "medusa-config")
    if (error) {
      this.#logger.error(`Failed to load medusa-config.(js|ts) file`)
      this.#logger.error(error)
      return
    }

    return { configFilePath, configModule }
  }

  /**
   * Given a tsconfig file, this method will write the compiled
   * output to the specified destination
   */
  async #emitBuildOutput(
    tsConfig: tsStatic.ParsedCommandLine,
    chunksToIgnore: string[],
    dist: string
  ): Promise<{
    emitResult: tsStatic.EmitResult
    diagnostics: tsStatic.Diagnostic[]
  }> {
    const ts = await this.#loadTSCompiler()
    const filesToCompile = tsConfig.fileNames.filter((fileName) => {
      return !chunksToIgnore.some((chunk) => fileName.includes(`${chunk}/`))
    })

    /**
     * Create emit program to compile and emit output
     */
    const program = ts.createProgram(filesToCompile, {
      ...tsConfig.options,
      ...{
        outDir: dist,
        inlineSourceMap: !tsConfig.options.sourceMap,
      },
    })

    const emitResult = program.emit()
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .concat(emitResult.diagnostics)

    /**
     * Log errors (if any)
     */
    if (diagnostics.length) {
      console.error(
        ts.formatDiagnosticsWithColorAndContext(
          diagnostics,
          ts.createCompilerHost({})
        )
      )
    }

    return { emitResult, diagnostics }
  }

  /**
   * Loads and parses the TypeScript config file. In case of an error, the errors
   * will be logged using the logger and undefined it returned
   */
  async loadTSConfigFile(): Promise<tsStatic.ParsedCommandLine | undefined> {
    const ts = await this.#loadTSCompiler()
    let tsConfigErrors: tsStatic.Diagnostic[] = []

    const tsConfig = ts.getParsedCommandLineOfConfigFile(
      path.join(this.#projectRoot, "tsconfig.json"),
      {
        inlineSourceMap: true,
        excludes: [],
      },
      {
        ...ts.sys,
        useCaseSensitiveFileNames: true,
        getCurrentDirectory: () => this.#projectRoot,
        onUnRecoverableConfigFileDiagnostic: (error) =>
          (tsConfigErrors = [error]),
      }
    )

    /**
     * Push errors from the tsConfig parsed output to the
     * tsConfigErrors array.
     */
    if (tsConfig?.errors.length) {
      tsConfigErrors.push(...tsConfig.errors)
    }

    /**
     * Display all config errors using the diagnostics reporter
     */
    if (tsConfigErrors.length) {
      const compilerHost = ts.createCompilerHost({})
      this.#logger.error(
        ts.formatDiagnosticsWithColorAndContext(tsConfigErrors, compilerHost)
      )
      return
    }

    /**
     * If there are no errors, the `tsConfig` object will always exist.
     */
    return tsConfig!
  }

  /**
   * Builds the application backend source code using
   * TypeScript's official compiler. Also performs
   * type-checking
   */
  async buildAppBackend(
    tsConfig: tsStatic.ParsedCommandLine
  ): Promise<boolean> {
    const tracker = this.#trackDuration()
    const dist = this.#computeDist(tsConfig)
    this.#logger.info("Compiling backend source...")

    /**
     * Step 1: Cleanup existing build output
     */
    this.#logger.info(
      `Removing existing "${path.relative(this.#projectRoot, dist)}" folder`
    )
    await this.#clean(dist)

    /**
     * Step 2: Compile TypeScript source code
     */
    const { emitResult, diagnostics } = await this.#emitBuildOutput(
      tsConfig,
      ["integration-tests", "test", "unit-tests", "src/admin"],
      dist
    )

    /**
     * Exit early if no output is written to the disk
     */
    if (emitResult.emitSkipped) {
      this.#logger.warn("Backend build completed without emitting any output")
      return false
    }

    /**
     * Step 3: Copy package manager files to the output folder
     */
    await this.#copyPkgManagerFiles(dist)

    /**
     * Notify about the state of build
     */
    if (diagnostics.length) {
      this.#logger.warn(
        `Backend build completed with errors (${tracker.getSeconds()}s)`
      )
    } else {
      this.#logger.info(
        `Backend build completed successfully (${tracker.getSeconds()}s)`
      )
    }

    return true
  }

  /**
   * Builds the frontend source code of a Medusa application
   * using the "@medusajs/admin-bundler" package.
   */
  async buildAppFrontend(
    adminOnly: boolean,
    tsConfig: tsStatic.ParsedCommandLine,
    adminBundler: {
      build: (
        options: AdminOptions & {
          sources: string[]
          outDir: string
        }
      ) => Promise<void>
    }
  ): Promise<boolean> {
    const tracker = this.#trackDuration()

    /**
     * Step 1: Load the medusa config file to read
     * admin options
     */
    const configFile = await this.#loadMedusaConfig()
    if (!configFile) {
      return false
    }

    /**
     * Return early when admin is disabled and we are trying to
     * create a bundled build for the admin.
     */
    if (configFile.configModule.admin.disable && !adminOnly) {
      this.#logger.info(
        "Skipping admin build, since its disabled inside the medusa-config file"
      )
      return false
    }

    /**
     * Warn when we are creating an admin only build, but forgot to disable
     * the admin inside the config file
     */
    if (!configFile.configModule.admin.disable && adminOnly) {
      this.#logger.warn(
        `You are building using the flag --admin-only but the admin is enabled in your medusa-config, If you intend to host the dashboard separately you should disable the admin in your medusa config`
      )
    }

    try {
      this.#logger.info("Compiling frontend source...")
      await adminBundler.build({
        disable: false,
        sources: [this.#adminSourceFolder],
        ...configFile.configModule.admin,
        outDir: adminOnly
          ? this.#adminOnlyDistFolder
          : path.join(this.#computeDist(tsConfig), "./public/admin"),
      })

      this.#logger.info(
        `Frontend build completed successfully (${tracker.getSeconds()}s)`
      )
      return true
    } catch (error) {
      this.#logger.error("Unable to compile frontend source")
      this.#logger.error(error)
      return false
    }
  }

  /**
   * @todo. To be implemented
   */
  buildPluginBackend() {}
  developPluginBacked() {}
}