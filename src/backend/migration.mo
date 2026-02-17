import OrderedMap "mo:base/OrderedMap";
import Text "mo:base/Text";
import Int "mo:base/Int";
import Nat "mo:base/Nat";

module {
  public type OldChatroom = {
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
  };

  public func run(oldSystem : { var chatrooms : OrderedMap.Map<Nat, OldChatroom> }) : { var chatrooms : OrderedMap.Map<Nat, NewChatroom> } {
    let natMap = OrderedMap.Make<Nat>(Nat.compare);

    let newChatrooms = natMap.map<OldChatroom, NewChatroom>(
      oldSystem.chatrooms,
      func(_id, oldChatroom) {
        {
          id = oldChatroom.id;
          topic = oldChatroom.topic;
          description = oldChatroom.description;
          mediaUrl = if (Text.size(oldChatroom.mediaUrl) > 0) {
            ?oldChatroom.mediaUrl;
          } else { null };
          mediaType = if (Text.size(oldChatroom.mediaType) > 0) {
            ?oldChatroom.mediaType;
          } else {
            null;
          };
          createdAt = oldChatroom.createdAt;
          messageCount = oldChatroom.messageCount;
          viewCount = oldChatroom.viewCount;
          pinnedVideoId = oldChatroom.pinnedVideoId;
          category = oldChatroom.category;
        };
      },
    );

    { var chatrooms = newChatrooms };
  };
};

