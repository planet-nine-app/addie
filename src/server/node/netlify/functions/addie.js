import serverless from 'serverless-http';
import { connectLambda } from '@netlify/blobs';
import app from '../../addie.js';

const rawHandler = serverless(app);

export const handler = async (event, context) => {
  // Populates the Netlify Blobs environment (siteID/token/edgeURL) from the
  // Lambda-style event, since Functions don't get it auto-injected the way
  // Edge Functions do. Must run before any db.js call touches the store.
  // `event.blobs` is only present on real Netlify infra - absent when running
  // against a local BlobsServer via BLOBS_LOCAL_URL/BLOBS_LOCAL_TOKEN instead.
  if (event.blobs) {
    connectLambda(event);
  }

  return rawHandler(event, context);
};
