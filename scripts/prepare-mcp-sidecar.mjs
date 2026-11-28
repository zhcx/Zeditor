import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] || process.env.TAURI_ENV_TARGET_TRIPLE || execFileSync('rustc', ['-vV'], { encoding: 'utf8' })
  .match(/^host:\s*(\S+)$/m)?.[1];
if (!target) throw new Error('无法确定 Rust target triple；请显式传入，例如 aarch64-apple-darwin。');
if (!/^[a-zA-Z0-9_-]+$/.test(target)) throw new Error(`无效的 Rust target triple：${target}`);

const extension = target.includes('windows') ? '.exe' : '';
const profile = process.argv[3] || process.env.CARGO_PROFILE || 'release';
const source = join(root, 'src-tauri', 'target', target, profile, `zeditor_mcp_server${extension}`);
const destination = join(root, 'src-tauri', 'binaries', `zeditor_mcp_server-${target}${extension}`);
// 每次都执行增量构建，避免 CI 恢复 target 缓存后把旧 sidecar 打进安装包。
// 首次构建时 sidecar 尚不存在，而 Tauri 的 build script 又要求 externalBin 已就绪；
// 先仅在本次子进程中清空 externalBin 编译 helper，避免循环依赖。
execFileSync('cargo', [
  'build', '--manifest-path', join(root, 'src-tauri', 'Cargo.toml'),
  '--locked', '--bin', 'zeditor_mcp_server', '--target', target, '--profile', profile,
], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, TAURI_CONFIG: JSON.stringify({ bundle: { externalBin: [] } }) },
});
if (!statSync(source).isFile()) throw new Error(`MCP sidecar 构建产物无效：${source}`);
mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
console.log(`MCP sidecar 已准备：${destination}`);
