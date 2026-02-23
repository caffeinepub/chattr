import OrderedMap "mo:base/OrderedMap";
import List "mo:base/List";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";

module {
  // Old Chatroom type without `lastActivity` field
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

  // Old actor state without `lastActivity`
  type OldActor = {
    chatrooms : OrderedMap.Map<Nat, OldChatroom>;
    messages : OrderedMap.Map<Nat, List.List<{
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
    }>>;
    activeUsers : OrderedMap.Map<Nat, List.List<{ userId : Text; lastActive : Int }>>;
    reactions : OrderedMap.Map<Nat, List.List<{ emoji : Text; count : Nat; users : List.List<Text> }>>;
    userProfiles : OrderedMap.Map<Principal, {
      name : Text;
      avatarUrl : ?Text;
      anonId : Text;
      presetAvatar : ?Text;
    }>;
    nextMessageId : Nat;
    nextChatroomId : Nat;
  };

  // New Chatroom type with `lastActivity` field
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

  // New actor state with `lastActivity`
  type NewActor = {
    chatrooms : OrderedMap.Map<Nat, NewChatroom>;
    messages : OrderedMap.Map<Nat, List.List<{
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
    }>>;
    activeUsers : OrderedMap.Map<Nat, List.List<{ userId : Text; lastActive : Int }>>;
    reactions : OrderedMap.Map<Nat, List.List<{ emoji : Text; count : Nat; users : List.List<Text> }>>;
    userProfiles : OrderedMap.Map<Principal, {
      name : Text;
      avatarUrl : ?Text;
      anonId : Text;
      presetAvatar : ?Text;
    }>;
    nextMessageId : Nat;
    nextChatroomId : Nat;
  };

  public func run(old : OldActor) : NewActor {
    let natMap = OrderedMap.Make<Nat>(Nat.compare);

    let newChatrooms = natMap.map<OldChatroom, NewChatroom>(
      old.chatrooms,
      func(_id, oldChatroom) {
        {
          oldChatroom with
          lastActivity = oldChatroom.createdAt;
        };
      },
    );

    {
      chatrooms = newChatrooms;
      messages = old.messages;
      activeUsers = old.activeUsers;
      reactions = old.reactions;
      userProfiles = old.userProfiles;
      nextMessageId = old.nextMessageId;
      nextChatroomId = old.nextChatroomId;
    };
  };
};
