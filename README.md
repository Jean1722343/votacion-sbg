# Votación · Core Team — AWS Student Builder Group

Web para que el equipo (Jean, Joan, Jeovanni, Gerónimo y la tutora) elija a quién entra al **Core Team** del AWS Student Builder Group.

Sitio: https://jean1722343.github.io/votacion-sbg/

- **Acceso:** cada quien toca su nombre. La primera vez crea su propia contraseña; después solo esa persona puede entrar y votar con ese nombre.
- **Regla:** cada votante tiene **2 votos** y debe dárselos a **2 candidatos distintos**. Los dos con más votos quedan en 1.º y 2.º lugar.
- **Voto secreto:** nadie ve conteos ni quién votó por quién, excepto Jean (`admin` en `data/config.js`), que tiene un botón exclusivo de Resultados. Firebase lo exige en el servidor.
- **Expediente:** perfil, redes y entrevistas (virtuales o presenciales) con audio/video y transcripción con buscador.
- **Analítica en vivo:** participación, ranking, podio con empates, matriz votante × candidato, duplas más elegidas, actividad y CSV.

## Dónde se edita cada cosa

| Qué | Archivo |
| --- | --- |
| Votantes y abrir/cerrar la votación | `data/config.js` |
| Candidatos, postulación y entrevistas (**privado**) | `privado/candidatos.js` (no se sube a GitHub) |
| Transcripciones (**privado**) | `privado/transcripciones/*.txt` |
| Audios y videos | links de Drive compartidos solo con el equipo, YouTube oculto o SoundCloud |

Los datos de los candidatos **no viven en este repositorio**: se guardan en Firestore y solo los leen los 5 votantes con sesión. Para actualizarlos: `node tools/candidatos.mjs` genera `privado/candidatos.json`, y Jean lo sube desde la web en 🔒 Resultados → Datos de candidatos.

Después de editar, corre `python tools/version.py` (evita que los navegadores mezclen archivos viejos y nuevos) y sube los cambios (`git add -A && git commit -m "..." && git push`). GitHub Pages se actualiza en ~1 minuto.

Formato de transcripción (una línea por intervención):

```
[00:00] Jean: Gracias por venir…
[00:12] María: Me interesa porque…
```

> GitHub no acepta archivos de más de 100 MB. Para audios largos usa un link de Drive compartido como "cualquiera con el enlace".

## Stack

- HTML + CSS + JavaScript (ES modules), sin build, publicado con GitHub Pages.
- Firebase Authentication guarda la contraseña de cada votante; Firestore guarda los votos (`votes/{idVotante}`) en tiempo real.
- Paleta oficial SBG con Space Grotesk + Inter. No se usan Amazon Ember ni logos oficiales (activos bajo NDA).

## Contraseñas

- Cada votante tiene una cuenta interna `<id>@sbg-vota.app` (el `id` de `data/config.js`). Nadie ve ni escribe ese correo.
- La primera persona que toca un nombre crea la contraseña de ese nombre; por eso conviene que cada quien entre pronto.
- Cada quien puede cambiar su contraseña desde su menú (arriba a la derecha).
- **Si alguien olvida su contraseña o alguien más tomó su nombre:** en Firebase Console → Authentication → Users, borra la cuenta `<id>@sbg-vota.app`, y en Firestore → Data → `voters`, borra el documento `<id>`. El nombre vuelve a aparecer como "Primera vez". Su voto (`votes/<id>`) se conserva; bórralo también si fue de otra persona.

## Reglas de Firestore

`firestore.rules` garantiza en el servidor que:

- solo el dueño de cada nombre escribe su voto, con exactamente 2 candidatos distintos;
- cada votante solo puede leer su propio voto; solo `jean` lee todos (resultados privados);
- solo el dueño marca su nombre como "con contraseña";
- los candidatos solo los leen los 5 votantes de la lista y solo Jean los actualiza;
- todo lo demás está bloqueado.

Si cambias las reglas, pégalas en Firebase Console → Firestore → Reglas → Publicar.

## Pruebas

Todo se prueba contra un Firebase **local** (emulador), sin tocar la votación real. Requiere Node y Java.

```
cd tests
npm install
npm run test:reglas      # 26 pruebas de seguridad de firestore.rules
npm run emulador         # Firebase local para probar la web a mano
```

Con el emulador corriendo, abre `http://127.0.0.1:5173/?emulador` (sirviendo la carpeta con `python -m http.server 5173`): la web usa el Firebase local y puedes crear votantes de prueba.

## Privacidad

El repositorio es público, pero no contiene datos de los postulantes: esos están en `privado/` (ignorada por git) y en Firestore, protegidos por las reglas. No pongas nombres, respuestas ni transcripciones en `data/` ni en ningún archivo que se suba.
