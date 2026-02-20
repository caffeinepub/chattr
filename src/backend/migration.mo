import OrderedMap "mo:base/OrderedMap";
import Principal "mo:base/Principal";

module {
  type OldUserProfile = {
    name : Text;
    avatarUrl : ?Text;
    anonId : Text;
    presetAvatar : ?Text;
  };

  type OldActor = {
    userProfiles : OrderedMap.Map<Principal, OldUserProfile>;
  };

  type NewUserProfile = {
    name : Text;
    avatarUrl : ?Text;
  };

  type NewActor = {
    userProfiles : OrderedMap.Map<Principal, NewUserProfile>;
  };

  public func run(old : OldActor) : NewActor {
    let principalMap = OrderedMap.Make<Principal>(Principal.compare);
    let userProfiles = principalMap.map<OldUserProfile, NewUserProfile>(
      old.userProfiles,
      func(_p, oldProfile) {
        {
          name = oldProfile.name;
          avatarUrl = oldProfile.avatarUrl;
        };
      },
    );
    { userProfiles };
  };
};
