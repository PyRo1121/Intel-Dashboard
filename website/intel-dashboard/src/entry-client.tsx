// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

const startClient = () => <StartClient />;

mount(startClient, document.getElementById("app")!);

export default startClient;
