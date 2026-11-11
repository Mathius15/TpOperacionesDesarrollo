import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateHabitatDto } from './dto';

// validate() devuelve la lista de errores: vacia = dato valido.
async function errores(datos: object): Promise<string[]> {
  const dto = plainToInstance(CreateHabitatDto, datos);
  return (await validate(dto)).map(
    (e) => Object.values(e.constraints ?? {})[0],
  );
}

describe('CreateHabitatDto', () => {
  it('acepta un nombre valido', async () => {
    expect(await errores({ nombre: 'Pampa' })).toEqual([]);
  });

  it('rechaza un nombre de menos de 3 letras', async () => {
    expect(await errores({ nombre: 'Pa' })).toEqual([
      'El nombre es obligatorio y debe tener al menos 3 letras',
    ]);
  });

  it('rechaza un nombre vacio', async () => {
    expect((await errores({ nombre: '' })).length).toBeGreaterThan(0);
  });
});
