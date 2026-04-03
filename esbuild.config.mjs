// Source: Official Obsidian sample plugin esbuild config
import esbuild from 'esbuild';
import process from 'process';
import builtins from 'builtin-modules';
import { copyFileSync } from 'fs';

const VAULT_PLUGIN_DIR = `${process.env.HOME}/Library/Mobile Documents/iCloud~md~obsidian/Documents/HB Vault/HB-Vault/.obsidian/plugins/canvas-ai`;

const banner = `/* THIS IS A GENERATED FILE. DO NOT EDIT. */`;
const prod = process.argv[2] === 'production';

const context = await esbuild.context({
  banner: { js: banner },
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete', '@codemirror/collab', '@codemirror/commands',
    '@codemirror/language', '@codemirror/lint', '@codemirror/search',
    '@codemirror/state', '@codemirror/view',
    '@lezer/common', '@lezer/highlight', '@lezer/lr',
    ...builtins,
  ],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  minify: prod,
});

/** Copy build artifacts to the Obsidian vault plugin directory */
function copyToVault() {
  try {
    for (const file of ['main.js', 'styles.css', 'manifest.json']) {
      copyFileSync(file, `${VAULT_PLUGIN_DIR}/${file}`);
    }
    console.log('Copied to vault plugin directory');
  } catch (e) {
    console.warn('Could not copy to vault (is the vault open?):', e.message);
  }
}

if (prod) {
  await context.rebuild();
  copyToVault();
  process.exit(0);
} else {
  await context.watch();
}
