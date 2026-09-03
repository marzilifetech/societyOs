const { withDangerousMod, createRunOncePlugin } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const pkg = { name: 'with-ios-fmt-cxx17', version: '1.0.0' };

const MARKER = '# with-ios-fmt-cxx17';

const HOOK = `
    ${MARKER} — do not edit by hand; see plugins/withIosFmtCxx17.js
    #
    # Xcode 26 / clang 17+ fails to compile the fmt pod that React Native 0.81
    # pins:
    #
    #   Pods/fmt/include/fmt/format-inl.h:59:24: error: call to consteval
    #   function 'fmt::basic_format_string<...>' is not a constant expression
    #
    # fmt's consteval format-string checking predates that stricter
    # constant-expression evaluation, so every iOS build dies in fmt/src/format.cc
    # before reaching any app code.
    #
    # A -D flag cannot fix it: fmt/base.h decides FMT_USE_CONSTEVAL through an
    # unconditional #if/#elif chain, so it overwrites anything defined on the
    # command line. That chain turns consteval OFF for anything below C++20
    # (\`#elif FMT_CPLUSPLUS < 201709L\`), so building the fmt pod at C++17 is
    # what actually takes effect. fmt supports C++11 upward; only this one pod
    # changes, and every other target keeps C++20.
    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'
      target.build_configurations.each do |cfg|
        cfg.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
`;

/**
 * Keeps the fmt C++17 workaround alive across `expo prebuild`.
 *
 * The generated `ios/` directory is gitignored (like `android/`), so editing
 * its Podfile by hand works exactly once and is silently lost on the next
 * prebuild — the next person to run it gets an unexplained native build
 * failure. Injecting the hook here makes it reproducible.
 *
 * Remove this plugin once React Native ships a fmt new enough for clang 17.
 */
const withIosFmtCxx17 = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');

      if (contents.includes(MARKER)) return cfg;

      // Append inside the existing `post_install do |installer|` block, right
      // after react_native_post_install's closing paren.
      const anchor = /(\n\s*\)\n)(\s*end\n)/;
      const rnPostInstall = contents.indexOf('react_native_post_install(');
      if (rnPostInstall === -1) {
        throw new Error(
          '[with-ios-fmt-cxx17] react_native_post_install( not found in Podfile — ' +
            'the template changed; update this plugin rather than skipping it.',
        );
      }
      const after = contents.slice(rnPostInstall);
      const m = after.match(anchor);
      if (!m) {
        throw new Error(
          '[with-ios-fmt-cxx17] could not locate the end of the post_install block.',
        );
      }
      const insertAt = rnPostInstall + m.index + m[1].length;
      contents = contents.slice(0, insertAt) + HOOK + contents.slice(insertAt);

      fs.writeFileSync(podfile, contents);
      return cfg;
    },
  ]);

module.exports = createRunOncePlugin(withIosFmtCxx17, pkg.name, pkg.version);
