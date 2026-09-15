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
