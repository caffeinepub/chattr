import OrderedMap "mo:base/OrderedMap";
import Nat "mo:base/Nat";
import List "mo:base/List";
import Iter "mo:base/Iter";
import Int "mo:base/Int";

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
    };

    type OldActiveUser = {
        userId : Text;
        lastActive : Int;
    };

    type OldActor = {
        chatrooms : OrderedMap.Map<Nat, OldChatroom>;
        activeUsers : OrderedMap.Map<Nat, List.List<OldActiveUser>>;
        // Please add other fields as needed
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
        pinnedVideoId : ?Nat;
        category : Text;
        lastActivity : Int;
    };

    type NewActiveUser = {
        userId : Text;
        lastActive : Int;
    };

    type NewActor = {
        chatrooms : OrderedMap.Map<Nat, NewChatroom>;
        activeUsers : OrderedMap.Map<Nat, List.List<NewActiveUser>>;
        // Please add other fields as needed
    };

    public func run(old : OldActor) : NewActor {
        let natMap = OrderedMap.Make<Nat>(Nat.compare);
        let chatrooms = natMap.map<OldChatroom, NewChatroom>(
            old.chatrooms,
            func(_id, oldChatroom) {
                {
                    oldChatroom with
                    lastActivity = oldChatroom.createdAt;
                };
            },
        );
        {
            old with
            chatrooms;
        };
    };
};
