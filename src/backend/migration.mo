import OrderedMap "mo:base/OrderedMap";
import Nat "mo:base/Nat";
import List "mo:base/List";

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
    activeUsers : OrderedMap.Map<Nat, List.List<{
      userId : Text;
      lastActive : Int;
    }>>;
    reactions : OrderedMap.Map<Nat, List.List<{
      emoji : Text;
      count : Nat;
      users : List.List<Text>;
    }>>;
    userProfiles : OrderedMap.Map<Principal, {
      name : Text;
      avatarUrl : ?Text;
      anonId : Text;
      presetAvatar : ?Text;
    }>;
    nextMessageId : Nat;
    nextChatroomId : Nat;
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
    archived : Bool;
    lastMessageTimestamp : Int;
  };

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
    activeUsers : OrderedMap.Map<Nat, List.List<{
      userId : Text;
      lastActive : Int;
    }>>;
    reactions : OrderedMap.Map<Nat, List.List<{
      emoji : Text;
      count : Nat;
      users : List.List<Text>;
    }>>;
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
    let chatrooms = natMap.map<OldChatroom, NewChatroom>(
      old.chatrooms,
      func(_id, oldChatroom) {
        {
          oldChatroom with
          archived = false;
          lastMessageTimestamp = oldChatroom.createdAt;
        };
      },
    );

    {
      chatrooms;
      messages = old.messages;
      activeUsers = old.activeUsers;
      reactions = old.reactions;
      userProfiles = old.userProfiles;
      nextMessageId = old.nextMessageId;
      nextChatroomId = old.nextChatroomId;
    };
  };
};
