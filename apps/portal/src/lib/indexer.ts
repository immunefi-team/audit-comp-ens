import { INDEXER_GRAPHQL_URL } from '@ens-apps/indexer/urql'
import { GraphQLClient } from 'graphql-request'

export const graphqlIndexerClient = new GraphQLClient(INDEXER_GRAPHQL_URL)
