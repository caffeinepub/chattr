import OrderedMap "mo:base/OrderedMap";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Text "mo:base/Text";
import List "mo:base/List";
import Array "mo:base/Array";

module {
    type OldMessage = {
        id : Nat;
        content : Text;
        timestamp : Int;
        sender : Text;
        chatroomId : Nat;
        mediaUrl : ?Text;
        mediaType : ?Text;
        avatarUrl : ?Text;
        senderId : Text;
        replyToMessageId : ?Nat;
    };

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

    type OldUserProfile = {
        name : Text;
        avatarUrl : ?Text;
        anonId : Text;
        presetAvatar : ?Text;
    };

    type OldActiveUser = {
        userId : Text;
        lastActive : Int;
    };

    type OldReaction = {
        emoji : Text;
        count : Nat;
        users : List.List<Text>;
    };

    type OldMessageWithReactions = {
        id : Nat;
        content : Text;
        timestamp : Int;
        sender : Text;
        chatroomId : Nat;
        mediaUrl : ?Text;
        mediaType : ?Text;
        avatarUrl : ?Text;
        senderId : Text;
        reactions : List.List<OldReaction>;
        replyToMessageId : ?Nat;
    };

    type OldReplyPreview = {
        messageId : Nat;
        sender : Text;
        contentSnippet : Text;
        mediaThumbnail : ?Text;
    };

    type OldActor = {
        nextMessageId : Nat;
        nextChatroomId : Nat;
        chatrooms : OrderedMap.Map<Nat, OldChatroom>;
        messages : OrderedMap.Map<Nat, List.List<OldMessage>>;
        activeUsers : OrderedMap.Map<Nat, List.List<OldActiveUser>>;
        reactions : OrderedMap.Map<Nat, List.List<OldReaction>>;
        userProfiles : OrderedMap.Map<Principal, OldUserProfile>;
    };

    type NewMessage = {
        id : Text;
        content : Text;
        timestamp : Int;
        sender : Text;
        chatroomId : Nat;
        mediaUrl : ?Text;
        mediaType : ?Text;
        avatarUrl : ?Text;
        senderId : Text;
        replyToMessageId : ?Text;
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
        pinnedVideoId : ?Text;
        category : Text;
        lastActivity : Int;
    };

    type NewActor = {
        nextMessageId : Nat;
        nextChatroomId : Nat;
        chatrooms : OrderedMap.Map<Nat, NewChatroom>;
        messages : OrderedMap.Map<Nat, List.List<NewMessage>>;
        activeUsers : OrderedMap.Map<Nat, List.List<OldActiveUser>>;
        reactions : OrderedMap.Map<Text, List.List<OldReaction>>;
        userProfiles : OrderedMap.Map<Principal, OldUserProfile>;
    };

    func formatMessageId(id : Nat) : Text {
        if (id < 1_000_000_000) {
            let idNat = Nat.toText(id);
            let padding = "000000000";
            let paddedId = Text.concat(padding, idNat);
            let size = Text.size(paddedId);
            let chars = Text.toArray(paddedId);
            let startIndex = if (size > 9) { size - 9 : Nat } else { 0 };
            let trimmedChars = Array.tabulate<Char>(
                9,
                func(i : Nat) : Char {
                    if (i + startIndex < chars.size()) {
                        chars[i + startIndex];
                    } else {
                        '0';
                    };
                },
            );
            Text.fromArray(trimmedChars);
        } else {
            Nat.toText(id);
        };
    };

    public func run(old : OldActor) : NewActor {
        let natMap = OrderedMap.Make<Nat>(Nat.compare);
        let textMap = OrderedMap.Make<Text>(Text.compare);

        var newMessages = natMap.empty<List.List<NewMessage>>();
        for ((chatroomId, oldMsgList) in natMap.entries(old.messages)) {
            let convertedMessages = List.map<OldMessage, NewMessage>(
                oldMsgList,
                func(oldMsg) {
                    {
                        oldMsg with
                        id = formatMessageId(oldMsg.id);
                        replyToMessageId = switch (oldMsg.replyToMessageId) {
                            case (null) { null };
                            case (?oldId) { ?formatMessageId(oldId) };
                        };
                    };
                },
            );
            newMessages := natMap.put(newMessages, chatroomId, convertedMessages);
        };

        var newChatrooms = natMap.empty<NewChatroom>();
        for ((id, oldChatroom) in natMap.entries(old.chatrooms)) {
            let convertedChatroom = {
                oldChatroom with
                pinnedVideoId = switch (oldChatroom.pinnedVideoId) {
                    case (null) { null };
                    case (?oldId) { ?formatMessageId(oldId) };
                };
            };
            newChatrooms := natMap.put(newChatrooms, id, convertedChatroom);
        };

        {
            nextMessageId = old.nextMessageId;
            nextChatroomId = old.nextChatroomId;
            chatrooms = newChatrooms;
            messages = newMessages;
            activeUsers = old.activeUsers;
            reactions = textMap.empty<List.List<OldReaction>>();
            userProfiles = old.userProfiles;
        };
    };
};

