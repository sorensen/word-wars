
Data structures
===============

* SET    (roomID):currentwords     ["(defenderID):(word)"]
* SET    (roomID):playedwords      ["(defenderID):(word)"]
* HASH   (roomID):currentplayers   {(socketID): "(ready):(seat)"}
* HASH   players                   {(socketID):(playerName)}
* KEY    sess:(sessionID)          "{name:(playerName)}"