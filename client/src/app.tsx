import { useState } from "react"
import ListenPage from "./listenPage/listenPage.jsx"
import BroadcastPage from "./broadcastPage/broadcastPage.jsx";
import Spinner from "./common/spinner.jsx"
import useIce from "./hooks/useIce.js"

export default function App () {
	const [ page, setPage ] = useState<"listen" | "studio">("listen");
	const {
		data: iceServers,
		isPending,
		isError,
		error
	} = useIce();

	function enterListen() {
		setPage("listen");
	}

	function enterStudio() {
		setPage("studio");
	}
	
	if (isPending) {
		return <Spinner />
	} else {
		if (page === "listen") {
			return <ListenPage onEnter={ enterStudio } iceServers={ iceServers } />
		} else {
			return <BroadcastPage onLeave={ enterListen } iceServers={ iceServers } />
		}
	}
}