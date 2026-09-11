import { useState } from "react"
import ListenPage from "./listenPage/listenPage.jsx"
import BroadcastPage from "./broadcastPage/broadcastPage.js";

export default function App () {
	const [ page, setPage ] = useState<"listen" | "studio">("listen");

	function enterListen() {
		setPage("listen");
	}

	function enterStudio() {
		setPage("studio");
	}
	
	if (page === "listen") {
		return <ListenPage onEnter={ enterStudio } />
	} else {
		return <BroadcastPage onLeave={ enterListen } />
	}
}