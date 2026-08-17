import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  config: {
    inlineFragmentTypes: 'combine',
    noGraphQLTag: true,
  },
  documents: './documents/**/*.graphql',
  generates: {
    'graphql.gen.ts': {
      config: {
        addDocBlocks: false,
        disableDescriptions: true,
        useTypeImports: true,
        withMutationFn: false,
        withMutationOptionsType: false,
        withResultType: false,
        nameSuffix: 'Document',
      },
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-document-nodes',
      ],
    },
    'possible-types.ts': {
      plugins: ['fragment-matcher'],
    },
  },
  hooks: { afterAllFileWrite: ['biome format --write .'] },
  overwrite: true,
  schema: 'https://staging-graphql.ens.dev/',
}

export default config
