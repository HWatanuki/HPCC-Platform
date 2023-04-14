/*##############################################################################

    HPCC SYSTEMS software Copyright (C) 2013 HPCC Systems®.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
############################################################################## */

#pragma warning( disable : 4786 )

#include "basesecurity.hpp"
#include "authmap.ipp"
#include <apr_md5.h>
#include "htpasswdSecurity.hpp"

class CHtpasswdSecurityManager : public CBaseSecurityManager
{
public:
    CHtpasswdSecurityManager(const char *serviceName, IPropertyTree *secMgrCfg, IPropertyTree *bindConfig) : CBaseSecurityManager(serviceName, (IPropertyTree *)NULL)
	{
        if (secMgrCfg)
            pwFile.set(secMgrCfg->queryProp("@htpasswdFile"));
        if(pwFile.isEmpty())
            throw MakeStringException(-1, "htpasswdFile not found in configuration");

        {
            Owned<IPropertyTree> authcfg = bindConfig->getPropTree("Authenticate");
            if(authcfg != nullptr)
            {
                StringBuffer authxml;
                toXML(authcfg, authxml);
                DBGLOG("HTPASS Authenticate Config: %s", authxml.str());
            }
        }

        {
            Owned<IPropertyTree> custombindingconfig = bindConfig->getPropTree("CustomBindingParameters");
            if(custombindingconfig != nullptr)
            {
                StringBuffer custconfigxml;
                toXML(custombindingconfig, custconfigxml);
                DBGLOG("HTPASS Custom Binding Config: %s", custconfigxml.str());
            }
        }

        apr_initialized = false;
	}

	~CHtpasswdSecurityManager()
	{
		userMap.kill();
	}

    SecFeatureSet queryFeatures(SecFeatureSupportLevel level) const override
    {
        SecFeatureSet mgrFeatures = CBaseSecurityManager::queryFeatures(level);
        switch (level)
        {
        case SFSL_Safe:
            mgrFeatures = mgrFeatures | s_safeFeatureMask;
            break;
        case SFSL_Implemented:
            mgrFeatures = mgrFeatures | s_implementedFeatureMask;
            break;
        case SFSL_Unsafe:
            mgrFeatures = mgrFeatures & ~s_safeFeatureMask;
            break;
        default:
            break;
        }
        return mgrFeatures;
    }

    secManagerType querySecMgrType() override
    {
        return SMT_HTPasswd;
    }

    inline virtual const char* querySecMgrTypeName() override { return "htpasswd"; }

    IAuthMap* createAuthMap(IPropertyTree* authconfig, IEspSecureContext* secureContext = nullptr) override
    {
        Owned<IAuthMap> authMap = new CAuthMap();
        createAuthMapImpl(authMap, "htpasswdsecurity", true, SecAccess_Full, authconfig, secureContext);
        return authMap.getClear();
    }

    IAuthMap* createFeatureMap(IPropertyTree* authconfig, IEspSecureContext* secureContext = nullptr) override
    {
        Owned<IAuthMap> featureMap = new CAuthMap();
        createFeatureMapImpl(featureMap, true, SecAccess_Full, authconfig, secureContext);
        return featureMap.getClear();
    }

    IAuthMap * createSettingMap(IPropertyTree * authConfig, IEspSecureContext* secureContext = nullptr) override
    {
        return nullptr;
    }
protected:

    //ISecManager
	bool IsPasswordValid(ISecUser& sec_user)
	{
		StringBuffer user;
		user.append(sec_user.getName());
		if (0 == user.length())
			throw MakeStringException(-1, "htpasswd User name is NULL");

        if (sec_user.credentials().getSessionToken() != 0 || sec_user.getAuthenticateStatus()==AS_AUTHENTICATED)//Already authenticated if token or status set to authenticated
		    return true;

		CriticalBlock block(crit);
		if (!apr_initialized)
			initAPR();
		loadPwds();//reload password file if modified
		StringAttr *encPW = userMap.getValue(user.str());
		if (encPW && encPW->length())
		{
			apr_status_t rc = apr_password_validate(sec_user.credentials().getPassword(), encPW->str());
			if (rc != APR_SUCCESS)
				DBGLOG("htpasswd authentication for user %s failed - APR RC %d", user.str(), rc );
			return rc == APR_SUCCESS;
		}
		DBGLOG("User %s not in htpasswd file", user.str());
		return false;
	}

    const char * getDescription() override
    {
        return "HTPASSWD Security Manager";
    }

    bool authorize(ISecUser & user, ISecResourceList * resources, IEspSecureContext* secureContext = nullptr) override
    {
        bool auth_ok = IsPasswordValid(user);
        if (auth_ok)
        {
            for (unsigned x = 0; x < resources->count(); x++)
            {
                ISecResource* resource = resources->queryResource(x);
                if (resource != nullptr)
                    resource->setAccessFlags(SecAccess_Full);
            }
        }
        return auth_ok;
    }

    unsigned getPasswordExpirationWarningDays(IEspSecureContext* secureContext = nullptr) override
    {
        return -2;//never expires
    }

    SecAccessFlags authorizeEx(SecResourceType rtype, ISecUser & user, const char * resourcename, IEspSecureContext* secureContext) override
    {
        return SecAccess_Full;//grant full access to authenticated users
    }

    SecAccessFlags getAccessFlagsEx(SecResourceType rtype, ISecUser& sec_user, const char* resourcename, IEspSecureContext* secureContext = nullptr) override
    {
        return SecAccess_Full;//grant full access to authenticated users
    }

    SecAccessFlags authorizeFileScope(ISecUser & user, const char * filescope, IEspSecureContext* secureContext = nullptr) override
    {
        return SecAccess_Full;//grant full access to authenticated users
    }

    bool authorizeViewScope(ISecUser & user, ISecResourceList * resources)
    {
        int nResources = resources->count();
        for (int ri = 0; ri < nResources; ri++)
        {
            ISecResource* res = resources->queryResource(ri);
            if(res != nullptr)
            {
                assertex(res->getResourceType() == RT_VIEW_SCOPE);
                res->setAccessFlags(SecAccess_Full);//grant full access to authenticated users
            }
        }
        return true;//success
    }

    SecAccessFlags authorizeWorkunitScope(ISecUser & user, const char * filescope, IEspSecureContext* secureContext = nullptr) override
    {
        return SecAccess_Full;//grant full access to authenticated users
    }

    bool logoutUser(ISecUser & user, IEspSecureContext* secureContext = nullptr) override
    {
        return true;
    }
private:

	void initAPR()
	{
		try
		{
			apr_status_t rc = apr_md5_init(&md5_ctx);
			if (rc != APR_SUCCESS)
				throw MakeStringException(-1, "htpasswd apr_md5_init returns error %d", rc );
			apr_initialized = true;
		}
		catch (...)
		{
			throw MakeStringException(-1, "htpasswd exception calling apr_md5_init");
		}
	}

	bool loadPwds()
	{
		try
		{
			if (!pwFile.length())
				throw MakeStringException(-1, "htpasswd Password file not specified");

			Owned<IFile> file = createIFile(pwFile.str());
			if (!file->exists())
			{
				userMap.kill();
				throw MakeStringException(-1, "htpasswd Password file does not exist");
			}

			bool isDir;
			offset_t size;
			CDateTime whenChanged;
			file->getInfo(isDir,size,whenChanged);
			if (isDir)
			{
				userMap.kill();
				throw MakeStringException(-1, "htpasswd Password file specifies a directory");
			}
			if (0 == whenChanged.compare(pwFileLastMod))
				return true;//Don't reload if file unchanged
			userMap.kill();
			OwnedIFileIO io = file->open(IFOread);
			if (!io)
				throw MakeStringException(-1, "htpasswd Unable to open Password file");

			MemoryBuffer mb;
			size32_t count = read(io, 0, (size32_t)-1, mb);
			if (0 == count)
				throw MakeStringException(-1, "htpasswd Password file is empty");

			mb.append((char)NULL);
			char * p = (char*)mb.toByteArray();
			char *saveptr;
			const char * seps = "\f\r\n";
			char * next = strtok_r(p, seps, &saveptr);
			if (next)
			{
				do
				{
					char * colon = strchr(next,':');
					if (NULL == colon)
						throw MakeStringException(-1, "htpasswd Password file appears malformed");
					*colon = (char)NULL;
					userMap.setValue(next, colon+1);//username, encrypted password
					next = strtok_r(NULL, seps, &saveptr);
				} while (next);
			}

			io->close();
			pwFileLastMod = whenChanged;//remember when last changed
		}
        catch(IException* e)
		{
            StringBuffer msg;
            if (strncmp(e->errorMessage(msg).str(), "htpasswd", 8) == 0)
                throw;
            int code = e->errorCode();
            e->Release();
            throw MakeStringException(code, "htpasswd Exception accessing Password file: %s", msg.str());
		}
		return true;
	}


private:
    static const SecFeatureSet s_implementedFeatureMask = SMF_QuerySecMgrType | SMF_QuerySecMgrTypeName | SMF_CreateAuthMap |
                                                          SMF_CreateFeatureMap | SMF_LogoutUser | SMF_GetDescription | SMF_Authorize |
                                                          SMF_GetPasswordExpirationDays | SMF_AuthorizeEx_Named | SMF_GetAccessFlagsEx |
                                                          SMF_AuthorizeFileScope_Named | SMF_AuthorizeWorkUnitScope_Named;
    static const SecFeatureSet s_safeFeatureMask = s_implementedFeatureMask | SMF_CreateSettingMap;
    mutable CriticalSection crit;
    StringBuffer    pwFile;
    CDateTime       pwFileLastMod;
	bool            apr_initialized;
    MapStringTo<StringAttr, const char *> userMap;
    apr_md5_ctx_t   md5_ctx;
};

extern "C"
{
    HTPASSWDSECURITY_API ISecManager * createInstance(const char *serviceName, IPropertyTree &secMgrCfg, IPropertyTree &bndCfg)
    {
        return new CHtpasswdSecurityManager(serviceName, &secMgrCfg, &bndCfg);
    }

}

