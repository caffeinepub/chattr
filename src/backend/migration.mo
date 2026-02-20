import List "mo:base/List";
import OrderedMap "mo:base/OrderedMap";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";

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

  type OldActor = {
    nextMessageId : Nat;
    nextChatroomId : Nat;
    chatrooms : OrderedMap.Map<Nat, {
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
    }>;
    messages : OrderedMap.Map<Nat, List.List<OldMessage>>;
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
  };

  type GifData = {
    id : Text;
    url : Text;
    title : Text;
    rating : Text;
    embed_url : Text;
    username : Text;
    source : Text;
    bitly_url : Text;
  };

  type MediaType = {
    #image;
    #gif;
    #video;
    #youtube;
    #twitch;
    #twitter;
    #audio;
    #unknown;
  };

  type Message = {
    id : Nat;
    content : Text;
    timestamp : Int;
    sender : Text;
    chatroomId : Nat;
    mediaUrl : ?Text;
    mediaType : ?MediaType;
    avatarUrl : ?Text;
    senderId : Text;
    replyToMessageId : ?Nat;
    gifData : ?GifData;
  };

  type NewActor = {
    nextMessageId : Nat;
    nextChatroomId : Nat;
    chatrooms : OrderedMap.Map<Nat, {
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
    }>;
    messages : OrderedMap.Map<Nat, List.List<Message>>;
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
  };

  public func run(old : OldActor) : NewActor {
    let natMap = OrderedMap.Make<Nat>(Nat.compare);

    func migrateMessage(oldMessage : OldMessage) : Message {
      {
        oldMessage with
        mediaType = null;
        gifData = null;
      };
    };

    let messages = natMap.map<List.List<OldMessage>, List.List<Message>>(
      old.messages,
      func(_id, oldMsgList) {
        List.map<OldMessage, Message>(
          oldMsgList,
          func(oldMsg) {
            migrateMessage(oldMsg);
          },
        );
      },
    );

    {
      old with
      messages;
    };
  };
};

