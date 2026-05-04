export function createMobileRelayPlan({ settings }) {
  const relay = settings.mobileRelay;

  if (!relay) {
    return {
      status: "not_configured"
    };
  }

  return {
    enabled: relay.enabled,
    status: relay.status,
    mode: relay.mode,
    provider: relay.provider,
    database: relay.database,
    retention: {
      imageRetentionHours: relay.imageRetentionHours,
      deleteAfterAck: relay.deleteAfterAck
    },
    limits: {
      maxImageBytes: relay.maxImageBytes,
      rateLimitPerPairPerMinute: relay.security.rateLimitPerPairPerMinute
    },
    objectLayout: {
      namespacePattern: relay.objectNamespacePattern,
      metadataStorage: relay.metadataStorage
    },
    pairing: relay.pairing,
    security: {
      transportTls: relay.security.transportTls,
      payloadEncryption: relay.security.payloadEncryption,
      relayCanReadImages: relay.security.relayCanReadImages,
      remoteCodexExecution: relay.security.remoteCodexExecution,
      maxClockSkewSeconds: relay.security.maxClockSkewSeconds
    },
    endpoints: [
      "POST /v1/mobile/jobs",
      "GET /v1/mobile/jobs/latest",
      "GET /v1/mobile/jobs/{jobId}/image",
      "POST /v1/mobile/jobs/{jobId}/ack"
    ],
    androidDelivery: relay.androidDelivery
  };
}
