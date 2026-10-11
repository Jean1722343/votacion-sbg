# Votación · Group Growth — AWS Student Builder Group

Web para que el equipo (4 integrantes + profesor asesor) elija a quién se queda en **Group Growth**.

Sitio: https://jean1722343.github.io/votacion-sbg/

- **Acceso:** cada quien toca su nombre y entra. Sin contraseñas.
- **Regla:** cada votante tiene **2 votos** y debe dárselos a **2 candidatos distintos**. Los dos con más votos quedan en 1.º y 2.º lugar.
- **Transparencia:** cada candidato muestra quién votó por él.
- **Expediente:** perfil, redes y entrevistas (virtuales o presenciales) con audio/video y transcripción con buscador.
- **Analítica en vivo:** participación, ranking, podio con empates, matriz votante × candidato, duplas más elegidas, actividad y CSV.

## Dónde se edita cada cosa

| Qué | Archivo |
| --- | --- |
| Votantes y abrir/cerrar la votación | `data/config.js` |
| Candidatos, redes y entrevistas | `data/candidatos.js` |
| Audios, videos y fotos | carpeta `media/` (o links de Drive / YouTube / SoundCloud) |
| Transcripciones largas | carpeta `transcripciones/` (archivos `.txt`) |

Después de editar, sube los cambios (`git add -A && git commit -m "..." && git push`). GitHub Pages se actualiza en ~1 minuto.

Formato de transcripción (una línea por intervención):

```
[00:00] Jean: Gracias por venir…
[00:12] María: Me interesa porque…
```

> GitHub no acepta archivos de más de 100 MB. Para audios largos usa un link de Drive compartido como "cualquiera con el enlace".

## Stack

- HTML + CSS + JavaScript (ES modules), sin build, publicado con GitHub Pages.
- Firebase Firestore solo guarda los votos (`votes/{idVotante}`), en tiempo real.
- Paleta oficial SBG con Space Grotesk + Inter. No se usan Amazon Ember ni logos oficiales (activos bajo NDA).

## Reglas de Firestore

`firestore.rules` exige que cada voto tenga exactamente 2 candidatos distintos y bloquea cualquier otra colección. Como no hay contraseñas, la identidad del votante es de confianza: cualquiera con el enlace podría votar a nombre de otro. Si cambias las reglas, pégalas en Firebase Console → Firestore → Reglas → Publicar.

## Privacidad

El repositorio es público: todo lo que pongas en `data/`, `media/` y `transcripciones/` lo puede ver cualquiera que tenga el enlace del repo o del sitio.
