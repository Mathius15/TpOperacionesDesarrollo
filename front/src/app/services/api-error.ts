import { HttpErrorResponse } from '@angular/common/http';

// El backend responde los errores como { message: string | string[] }.
// Esta funcion saca un texto legible de cualquier error de la API.
export function mensajeDeError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Ocurrio un error inesperado';
  }

  const { message } = error.error ?? {};

  if (Array.isArray(message)) {
    return message.join('. ');
  }

  if (typeof message === 'string' && message.length > 0) {
    return message;
  }

  return `Error ${error.status} al llamar a la API`;
}