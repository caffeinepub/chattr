import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import List "mo:base/List";

module {
  type Chatroom = {
    id : Nat;
    topic : Text;
    description : Text;
    mediaUrl : Text;
    mediaType : Text;
    createdAt : Int;
    messageCount : Nat;
    viewCount : Nat;
    pinnedVideoId : ?Nat;
    category : Text;
  };

  type Message = {
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

  type ActiveUser = {
    userId : Text;
    lastActive : Int;
  };

  type Reaction = {
    emoji : Text;
    count : Nat;
    users : List.List<Text>;
  };

  type UserProfile = {
    name : Text;
    avatarUrl : ?Text;
    anonId : Text;
    presetAvatar : ?Text;
  };

  type OldActor = {
    chatrooms : OrderedMap.Map<Nat, Chatroom>;
    messages : OrderedMap.Map<Nat, List.List<Message>>;
    activeUsers : OrderedMap.Map<Nat, List.List<ActiveUser>>;
    reactions : OrderedMap.Map<Nat, List.List<Reaction>>;
    userProfiles : OrderedMap.Map<Principal, UserProfile>;
    nextMessageId : Nat;
    nextChatroomId : Nat;
    adminPassword : Text;
  };

  type NewActor = {
    chatrooms : OrderedMap.Map<Nat, Chatroom>;
    messages : OrderedMap.Map<Nat, List.List<Message>>;
    activeUsers : OrderedMap.Map<Nat, List.List<ActiveUser>>;
    reactions : OrderedMap.Map<Nat, List.List<Reaction>>;
    userProfiles : OrderedMap.Map<Principal, UserProfile>;
    nextMessageId : Nat;
    nextChatroomId : Nat;
    adminPassword : Text;
  };

  public func run(old : OldActor) : NewActor {
    old;
  };
};

