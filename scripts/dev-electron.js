// Lanza Electron eliminando ELECTRON_RUN_AS_NODE del entorno.
// Los terminales integrados de IDEs basados en Electron (VS Code, Windsurf...)
// exportan ELECTRON_RUN_AS_NODE=1, lo que hace que `electron .` arranque como
// Node puro y require("electron") devuelva una ruta en vez de la API,
// rompiendo el arranque (app.getPath undefined en db/connection).
const { spawn } = require("child_process");
const electronBinary = require("electron");

delete process.env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, ["."], {
  stdio: "inherit",
  env: process.env,
});

child.on("close", (code) => process.exit(code ?? 0));
