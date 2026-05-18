import type {
  DatadogEvent,
  OutboundPublishResult,
  OutboundPublisher,
} from '../types.js';

export class CompositePublisher implements OutboundPublisher {
  readonly name = 'composite';
  private readonly publishers: OutboundPublisher[];

  constructor(publishers: OutboundPublisher[]) {
    this.publishers = publishers;
  }

  async publish(event: DatadogEvent): Promise<OutboundPublishResult> {
    const results = await Promise.all(this.publishers.map((publisher) => publisher.publish(event)));
    const failures = results.filter((result) => !result.ok);
    if (failures.length > 0) {
      return {
        publisher: this.name,
        ok: false,
        error: failures.map((failure) => `${failure.publisher}: ${failure.error ?? 'unknown error'}`).join('; '),
      };
    }
    return {
      publisher: this.name,
      ok: true,
    };
  }
}
