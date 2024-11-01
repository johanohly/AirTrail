export class RequestRateLimiter {
  private requests: number[] = [];
  private softLimit: number;
  private softBlockTime: number;
  private hardLimit: number;
  private hardBlockTime: number;
  private timeWindow: number;
  private isBlockedUntil: number = 0;

  constructor(
    softLimit = 512,
    softBlockTime = 60,
    hardLimit = 1024,
    hardBlockTime = 300,
    timeWindow = 60000,
  ) {
    this.softLimit = softLimit;
    this.softBlockTime = softBlockTime * 1000;
    this.hardLimit = hardLimit;
    this.hardBlockTime = hardBlockTime * 1000;
    this.timeWindow = timeWindow;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitUntilUnblocked() {
    const waitTime = this.isBlockedUntil - Date.now();
    if (waitTime > 0) {
      console.log(
        `Waiting for ${Math.ceil(waitTime / 1000)} seconds to retry...`,
      );
      await this.wait(waitTime);
    }
  }

  public async checkRequest(): Promise<void> {
    await this.waitUntilUnblocked();

    const currentTime = Date.now();

    this.requests = this.requests.filter(
      (timestamp) => currentTime - timestamp < this.timeWindow,
    );

    if (this.requests.length >= this.hardLimit) {
      this.isBlockedUntil = currentTime + this.hardBlockTime;
      await this.waitUntilUnblocked();
    } else if (this.requests.length >= this.softLimit) {
      this.isBlockedUntil = currentTime + this.softBlockTime;
      await this.waitUntilUnblocked();
    }

    this.requests.push(currentTime);
  }
}
