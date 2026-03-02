import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Nat "mo:base/Nat";

module {
    type OldChatroom = {
        id : Nat;
        topic : Text;
        description : Text;
        mediaUrl : ?Text;
        mediaType : ?Text;
        createdAt : Int;
        messageCount : Nat;
        viewCount : Nat;
        pinnedVideoId : ?Nat;
        category : Text;
        lastActivity : Int;
    };

    type OldActor = {
        chatrooms : OrderedMap.Map<Nat, OldChatroom>;
    };

    type NewChatroom = {
        id : Nat;
        topic : Text;
        description : Text;
        mediaUrl : ?Text;
        mediaType : ?Text;
        createdAt : Int;
        messageCount : Nat;
        viewCount : Nat;
        category : Text;
        lastActivity : Int;
    };

    type NewActor = {
        chatrooms : OrderedMap.Map<Nat, NewChatroom>;
    };

    public func run(old : OldActor) : NewActor {
        let chatroomMap = OrderedMap.Make<Nat>(Nat.compare);
        let chatrooms = chatroomMap.map<OldChatroom, NewChatroom>(
            old.chatrooms,
            func(_id, oldChatroom) {
                oldChatroom;
            },
        );
        { chatrooms };
    };
};
