# cms

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build cms` to build the library.

## Extending

Any plugin that wants to add an admin module to the CMS drops one uniquely-named
`*.module.tsx` file into `src/modules/`, default-exporting a `CmsModule` descriptor
(`{ id, navLabel, order?, Component }`). `src/modules/registry.ts` auto-discovers every
matching file via `import.meta.glob` at build time — no shared file needs editing to add
a module.
