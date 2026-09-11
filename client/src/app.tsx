import { useState } from "react"
import ListenPage from "./listenPage/listenPage.jsx"

export default function App () {
	const [ page, setPage ] = useState<"listen" | "studio">("listen");

	function enterListen() {
		setPage("listen");
	}

	function enterStudio() {
		setPage("studio");
	}
	
	if (page === "listen") {
		return <ListenPage onEnter={ enterListen } />
	} else {
		return null;
	}
}