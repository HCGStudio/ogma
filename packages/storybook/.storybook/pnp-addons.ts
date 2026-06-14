import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const resolve = (specifier: string) => require.resolve(specifier);

export const addons = [
  resolve('@storybook/addon-docs/preset'),
  resolve('@storybook/addon-a11y/preset')
];

export const managerEntries = (entries: string[] = []) => [
  ...entries,
  resolve('@storybook/addon-docs/manager'),
  resolve('@storybook/addon-a11y/manager')
];

export const previewAnnotations = (entries: string[] = []) => [
  ...entries,
  resolve('@storybook/addon-docs/preview'),
  resolve('@storybook/addon-a11y/preview')
];
