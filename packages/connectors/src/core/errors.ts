export class ConnectorError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ConnectorError';
  }
}

export class ConnectorHttpError extends ConnectorError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(message, `http_${status}`);
    this.name = 'ConnectorHttpError';
  }
}

/** The provider integration exists only as a stub (needs a partnership / approval). */
export class NotAvailableError extends ConnectorError {
  constructor(message: string) {
    super(message, 'not_available');
    this.name = 'NotAvailableError';
  }
}

export class ConsentRequiredError extends ConnectorError {
  constructor(message: string) {
    super(message, 'consent_required');
    this.name = 'ConsentRequiredError';
  }
}

/** An action that publishes on the student's behalf was attempted without explicit approval. */
export class ApprovalRequiredError extends ConnectorError {
  constructor(message: string) {
    super(message, 'approval_required');
    this.name = 'ApprovalRequiredError';
  }
}

export class ProductionNotAllowedError extends ConnectorError {
  constructor(message: string) {
    super(message, 'production_not_allowed');
    this.name = 'ProductionNotAllowedError';
  }
}
