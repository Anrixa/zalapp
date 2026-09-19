// Metro, taught about the monorepo.
//
// Two things are needed that a single-app setup does not have: Metro must watch
// the workspace root so a change in @zal/contracts triggers a reload, and it
// must be able to resolve through pnpm's symlinks.
//
// Note what is deliberately NOT set: `disableHierarchicalLookup`. That flag
// suits a hoisting package manager, where every dependency sits in one root
// folder. pnpm gives each package its own `node_modules` of symlinks into the
// store, so switching hierarchical lookup off stops Metro finding a transitive
// dependency from inside the package that declares it — which surfaces as
// "Unable to resolve @babel/runtime/..." from a file nobody wrote.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
