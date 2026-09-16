export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Ressource introuvable') {
    super(404, message);
  }
}

export class ValidationError extends HttpError {
  constructor(message = 'Requête invalide') {
    super(400, message);
  }
}

/** La requête est bien formée mais le contenu distant est inexploitable. */
export class UnprocessableEntityError extends HttpError {
  constructor(message = 'Contenu inexploitable') {
    super(422, message);
  }
}

/** Un service distant (site de recettes) est injoignable ou répond en erreur. */
export class BadGatewayError extends HttpError {
  constructor(message = 'Service distant injoignable') {
    super(502, message);
  }
}

/** Un service distant n’a pas répondu dans le délai imparti. */
export class GatewayTimeoutError extends HttpError {
  constructor(message = 'Délai d’attente dépassé') {
    super(504, message);
  }
}
